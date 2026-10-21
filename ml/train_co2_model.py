"""
Trains the two Random Forest models used ONLY by the CO2 Prediction module.

1. Traffic-pattern model  (ml/datasets/bangalore_routes1.csv.gz)
   hour, weekend flag, peak flag, weather, live speed, lat, lon -> vehicles
2. CO2 emission model      (ml/datasets/co2-emissions-india.csv)
   state, year, GDP, urbanisation, energy use -> Carbon_Emissions_MtCO2

The two datasets are never merged (different time/space granularity).
They are combined only at prediction time in src/lib/co2/co2.server.ts.

Run:  python3 ml/train_co2_model.py   -> writes src/lib/co2/co2-model.json
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent
DS = ROOT / "ml" / "datasets"
OUT = ROOT / "src" / "lib" / "co2" / "co2-model.json"
WEATHER = ["Clear", "Cloudy", "Rainy", "Foggy"]


def export_trees(rf, digits=4):
    trees = []
    for est in rf.estimators_:
        t = est.tree_
        trees.append({
            "f": t.feature.tolist(),
            "t": [round(float(x), digits) for x in t.threshold],
            "l": t.children_left.tolist(),
            "r": t.children_right.tolist(),
            "v": [round(float(x), digits) for x in t.value[:, 0, 0]],
        })
    return trees


def fit(X, y, names, n, depth, leaf, ordered=False):
    if ordered:
        # Ordered hold-out: the last 20% of records (file order) are kept for testing.
        cut = int(len(X) * 0.8)
        Xtr, Xte, ytr, yte = X[:cut], X[cut:], y[:cut], y[cut:]
    else:
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)
    rf = RandomForestRegressor(n_estimators=n, max_depth=depth, min_samples_leaf=leaf,
                               random_state=42, n_jobs=-1)
    rf.fit(Xtr, ytr)
    p = rf.predict(Xte)
    metrics = {
        "dataset_size": int(len(X)), "training_records": int(len(Xtr)), "testing_records": int(len(Xte)),
        "split": "ordered (last 20% of file rows)" if ordered else "random 80/20",
        "mae": float(mean_absolute_error(yte, p)),
        "rmse": float(np.sqrt(mean_squared_error(yte, p))),
        "r2": float(r2_score(yte, p)),
    }
    if ordered:
        # Honest reference: hour-of-day mean (train rows only) vs the forest.
        h = pd.Series(ytr).groupby(Xtr[:, 0]).mean()
        metrics["baseline_hourly_mean_r2"] = float(r2_score(yte, pd.Series(Xte[:, 0]).map(h).fillna(ytr.mean())))
    else:
        from sklearn.linear_model import LinearRegression
        e = names.index("Energy_Use_TWh")
        metrics["baseline_energy_only_linear_r2"] = float(r2_score(yte, LinearRegression().fit(Xtr[:, [e]], ytr).predict(Xte[:, [e]])))
    imp = sorted(({"feature": f, "importance": float(i)} for f, i in zip(names, rf.feature_importances_)),
                 key=lambda d: -d["importance"])
    return rf, metrics, imp


# ── Traffic model ──
# Unit checks (verified on the data): travel_time == distance / speed * 60 exactly
# (corr 1.0), so the generator treated distance as km and travel_time as minutes;
# but distance equals the straight lat/lon gap in DEGREES, so it is not a road
# length. One record per route x day-type x hour, vehicles <= road_capacity
# (ratio 0.05-0.95) => vehicles is read as an hourly flow (undocumented).
# The file has no calendar dates, so a true time-based split is impossible;
# the last 20% of rows in file order are held out instead.
t = pd.read_csv(DS / "bangalore_routes1.csv.gz")
t["is_weekend"] = (t["day_of_week"] == "Weekend").astype(int)
t["weather_code"] = t["weather"].map({w: i for i, w in enumerate(WEATHER)})
t = t.dropna(subset=["weather_code"]).reset_index(drop=True)
tf = ["hour", "is_weekend", "is_peak", "weather_code", "speed", "lat_src", "lon_src"]
traffic_rf, traffic_metrics, traffic_imp = fit(t[tf].values, t["vehicles"].values, tf, 30, 12, 20, ordered=True)
peak_by_hour = t.groupby("hour")["is_peak"].mean()
hourly = t.groupby(["is_weekend", "hour"])["vehicles"].mean()


def haversine_km(la1, lo1, la2, lo2):
    la1, lo1, la2, lo2 = map(np.radians, (la1, lo1, la2, lo2))
    a = np.sin((la2 - la1) / 2) ** 2 + np.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2
    return 6371.0 * 2 * np.arcsin(np.sqrt(a))


# Per-zone link length: median great-circle length (source -> destination
# coordinates) of dataset routes starting within 2 km of each zone. This is a
# straight-line lower bound of road length, computed from real coordinates.
t["link_km"] = haversine_km(t["lat_src"], t["lon_src"], t["lat_dest"], t["lon_dest"])
ZONES = {1: (12.9177, 77.6230), 2: (12.9160, 77.6101), 3: (12.9116, 77.6412), 4: (12.9082, 77.6205),
         5: (12.9507, 77.5848), 6: (12.9417, 77.5738), 7: (12.9250, 77.5938), 8: (12.9445, 77.5801)}
zone_distance = {}
for zid, (la, lo) in ZONES.items():
    d_km = haversine_km(t["lat_src"], t["lon_src"], la, lo)
    near = t[(d_km <= 2.0) & (t["link_km"] > 0)]
    if len(near) == 0:
        near = t.loc[d_km.nsmallest(200).index]
    zone_distance[str(zid)] = {
        "distance_km": round(float(near["link_km"].median()), 3),
        "routes": int(near[["source_location", "destination_location"]].drop_duplicates().shape[0]),
        "nearest_source": str(near.loc[d_km[near.index].idxmin(), "source_location"]),
    }

# ── CO2 model ──
c = pd.read_csv(DS / "co2-emissions-india.csv")
states = sorted(c["State"].unique())
c["state_code"] = c["State"].map({s: i for i, s in enumerate(states)})
cf = ["state_code", "Year", "GDP_BillionINR", "Urbanization_Percent", "Energy_Use_TWh"]
co2_rf, co2_metrics, co2_imp = fit(c[cf].values, c["Carbon_Emissions_MtCO2"].values, cf, 60, 12, 1)
k = c[c["State"] == "Karnataka"].sort_values("Year")
latest = k.iloc[-1]

artifact = {
    "trained_at": datetime.now(timezone.utc).isoformat(),
    "traffic": {
        "dataset": "bangalore_routes1.csv",
        "target": "vehicles",
        "feature_names": tf,
        "weather_codes": WEATHER,
        "peak_hours": [int(h) for h, v in peak_by_hour.items() if v >= 0.5],
        "mean_vehicles": float(t["vehicles"].mean()),
        "hourly_profile": {
            "weekday": [round(float(hourly.get((0, h), np.nan)), 1) for h in range(24)],
            "weekend": [round(float(hourly.get((1, h), np.nan)), 1) for h in range(24)],
        },
        "zone_distance": zone_distance,
        "metrics": traffic_metrics, "feature_importance": traffic_imp,
        "trees": export_trees(traffic_rf, 3),
    },
    "co2": {
        "dataset": "CO2 emissions India.csv",
        "target": "Carbon_Emissions_MtCO2",
        "feature_names": cf,
        "states": states,
        "karnataka_latest": {
            "Year": int(latest["Year"]),
            "GDP_BillionINR": float(latest["GDP_BillionINR"]),
            "Urbanization_Percent": float(latest["Urbanization_Percent"]),
            "Energy_Use_TWh": float(latest["Energy_Use_TWh"]),
            "Carbon_Emissions_MtCO2": float(latest["Carbon_Emissions_MtCO2"]),
        },
        "metrics": co2_metrics, "feature_importance": co2_imp,
        "trees": export_trees(co2_rf, 3),
    },
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(artifact, separators=(",", ":")))
print("traffic", traffic_metrics, "\nco2", co2_metrics, "\npeak", artifact["traffic"]["peak_hours"],
      "\nzones", zone_distance, "\nsize MB", OUT.stat().st_size / 1e6)
