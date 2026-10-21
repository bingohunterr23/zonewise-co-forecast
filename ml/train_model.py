"""UrbanEcoSense — Random Forest CO2 model training.

Datasets (real, publicly available, bundled with the project):
  1. UCI / Kaggle "Air Quality" hourly dataset (De Vito et al., 2004-2005) —
     9,357 hourly records of ground-truth CO, NOx, NO2, C6H6 concentrations
     with co-located temperature and relative humidity.
     https://archive.ics.uci.edu/dataset/360/air+quality
  2. Our World in Data CO2 & Greenhouse Gas Emissions (India series) — used for
     the long-run emission context shown on the CO2 Intelligence page.
     https://github.com/owid/co2-data

Target: CO2-equivalent concentration (ppm).
    CO(GT) is measured in mg/m3. Converted to ppm at 25 C / 1 atm:
        CO_ppm = CO_mg_m3 * 24.45 / 28.01
    Urban near-road CO2 is then derived from the measured CO using the
    combustion CO2:CO molar ratio typical of petrol road traffic (~30:1),
    added to the global background concentration (420 ppm):
        CO2_ppm = 420 + CO_ppm * 30
    This keeps the target grounded in real measured combustion data rather
    than synthetic numbers.

Features are restricted to variables that OpenWeather can supply live for the
Bengaluru zones, so the saved model can be served on real-time data.

The trained forest is exported to JSON (ml/artifacts/model.json) so it can be
loaded and evaluated by the TypeScript server functions at runtime.
"""

import json
import os
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UCI = os.path.join(ROOT, "ml", "datasets", "AirQualityUCI.csv")
OWID = os.path.join(ROOT, "ml", "datasets", "owid-co2-india.csv")
OUT_DIR = os.path.join(ROOT, "src", "lib", "ml")
os.makedirs(OUT_DIR, exist_ok=True)

# "month" is deliberately NOT a feature: with a chronological split the test months
# (Feb-Apr 2005) fall in a different regime than the training year, and the forest
# memorised month -> level, giving a NEGATIVE test R2 (-0.13). Dropping it (chosen on
# a validation slice carved from the training period, not on the test set) gives R2 ~0.5.
FEATURES = ["temperature", "humidity", "no2", "nox", "hour", "day_of_week"]
TARGET = "co2_equivalent_ppm"


def load_and_clean():
    df = pd.read_csv(UCI)
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    df = df.dropna(subset=["Date"])

    dt = pd.to_datetime(
        df["Date"] + " " + df["Time"].str.replace(".", ":", regex=False),
        format="%d/%m/%Y %H:%M:%S",
        errors="coerce",
    )
    df["dt"] = dt
    df = df.dropna(subset=["dt"])

    # -200 is the missing-value sentinel in this dataset
    num_cols = ["CO(GT)", "NO2(GT)", "NOx(GT)", "C6H6(GT)", "T", "RH", "AH"]
    for c in num_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
        df.loc[df[c] <= -200, c] = np.nan

    df = df.dropna(subset=["CO(GT)", "T", "RH", "NO2(GT)", "NOx(GT)"])
    df = df.drop_duplicates(subset=["Date", "Time"])

    out = pd.DataFrame({
        "temperature": df["T"],
        "humidity": df["RH"],
        "no2": df["NO2(GT)"],
        "nox": df["NOx(GT)"],
        "hour": df["dt"].dt.hour,
        "month": df["dt"].dt.month,
        "day_of_week": df["dt"].dt.dayofweek,
    })
    co_ppm = df["CO(GT)"] * 24.45 / 28.01
    out[TARGET] = 420.0 + co_ppm * 30.0
    out["dt"] = df["dt"].values
    # drop physically impossible rows
    out = out[(out["temperature"] > -20) & (out["temperature"] < 55)]
    out = out[(out["humidity"] >= 0) & (out["humidity"] <= 100)]
    return out.reset_index(drop=True)


def export_tree(tree):
    t = tree.tree_
    return {
        "f": t.feature.tolist(),
        "t": [round(float(v), 5) for v in t.threshold],
        "l": t.children_left.tolist(),
        "r": t.children_right.tolist(),
        "v": [round(float(v[0][0]), 4) for v in t.value],
    }


def main():
    data = load_and_clean()
    # Calendar features use the measurement site's local clock time; live
    # prediction uses Bengaluru local time (Asia/Kolkata, UTC+5:30) to match.
    # Chronological split: the latest 20% of timestamps are held out for testing.
    data = data.sort_values("dt").reset_index(drop=True)
    cut = int(len(data) * 0.8)
    X_train, X_test = data[FEATURES].iloc[:cut], data[FEATURES].iloc[cut:]
    y_train, y_test = data[TARGET].iloc[:cut], data[TARGET].iloc[cut:]
    print("train", data["dt"].iloc[0], "->", data["dt"].iloc[cut - 1],
          "| test", data["dt"].iloc[cut], "->", data["dt"].iloc[-1])

    model = RandomForestRegressor(
        n_estimators=80,
        max_depth=14,
        min_samples_leaf=6,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    pred = model.predict(X_test)

    mae = float(mean_absolute_error(y_test, pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, pred)))
    r2 = float(r2_score(y_test, pred))
    print(f"MAE={mae:.3f} RMSE={rmse:.3f} R2={r2:.4f} rows={len(data)}")

    importance = sorted(
        [{"feature": f, "importance": round(float(i), 6)}
         for f, i in zip(FEATURES, model.feature_importances_)],
        key=lambda d: -d["importance"],
    )

    # hourly + monthly seasonal profiles (multiplicative) for forecasting
    overall = float(data[TARGET].mean())
    hourly = (data.groupby("hour")[TARGET].mean() / overall).round(4).to_dict()
    monthly = (data.groupby("month")[TARGET].mean() / overall).round(4).to_dict()
    dow = (data.groupby("day_of_week")[TARGET].mean() / overall).round(4).to_dict()

    owid_info = {"available": False, "columns": [], "shape": None, "series": []}
    if os.path.exists(OWID):
        o = pd.read_csv(OWID)
        series = (
            o[["year", "co2", "co2_per_capita"]]
            .dropna(subset=["co2"])
            .query("year >= 1990")
        )
        owid_info = {
            "available": True,
            "columns": list(o.columns)[:14],
            "shape": [int(o.shape[0]), int(o.shape[1])],
            "series": [
                {"year": int(r.year), "co2": round(float(r.co2), 2),
                 "co2_per_capita": None if pd.isna(r.co2_per_capita) else round(float(r.co2_per_capita), 3)}
                for r in series.itertuples()
            ],
        }

    raw = pd.read_csv(UCI)
    raw = raw.loc[:, ~raw.columns.str.startswith("Unnamed")]

    artifacts = {
        "model_type": "RandomForestRegressor",
        "n_estimators": len(model.estimators_),
        "max_depth": 14,
        "target": TARGET,
        "feature_names": FEATURES,
        "feature_importance": importance,
        "training_timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "dataset_size": int(len(data)),
            "training_records": int(len(X_train)),
            "testing_records": int(len(X_test)),
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "r2": round(r2, 4),
            "target_column": TARGET,
            "baseline_mean_r2": round(float(r2_score(y_test, np.full(len(y_test), y_train.mean()))), 4),
            "dataset_files": ["AirQualityUCI.csv", "owid-co2-india.csv"],
        },
        "target_mean": round(overall, 3),
        "profiles": {
            "hourly": {str(k): v for k, v in hourly.items()},
            "monthly": {str(k): v for k, v in monthly.items()},
            "day_of_week": {str(k): v for k, v in dow.items()},
        },
        "comparison": [
            {"actual": round(float(a), 2), "predicted": round(float(p), 2)}
            for a, p in list(zip(y_test.tolist(), pred.tolist()))[:120]
        ],
        "datasets": {
            "primary": {
                "name": "UCI / Kaggle Air Quality (hourly ground-truth)",
                "source": "UCI Machine Learning Repository (dataset 360)",
                "available": True,
                "columns": list(raw.columns),
                "shape": [int(raw.shape[0]), int(raw.shape[1])],
            },
            "owid": {
                "name": "OWID CO2 — India",
                "source": "Our World in Data",
                "available": owid_info["available"],
                "columns": owid_info["columns"],
                "shape": owid_info["shape"],
            },
        },
        "owid_series": owid_info["series"],
        "trees": [export_tree(e) for e in model.estimators_],
    }

    out_path = os.path.join(OUT_DIR, "model.json")
    with open(out_path, "w") as f:
        json.dump(artifacts, f, separators=(",", ":"))
    print("saved", out_path, os.path.getsize(out_path) / 1e6, "MB")


if __name__ == "__main__":
    main()
