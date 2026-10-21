/**
 * Server-side loader + inference engine for the Random Forest CO2 model.
 *
 * The forest is trained offline by `ml/train_model.py` on the real, publicly
 * available UCI / Kaggle "Air Quality" hourly dataset (De Vito et al.) and
 * exported to `model.json` (structure of every tree + metrics + profiles).
 * This module loads that artifact and evaluates the forest in pure TypeScript,
 * so predictions come from the trained model — never random numbers.
 */
import artifact from "./model.json";

interface TreeJson {
  f: number[];
  t: number[];
  l: number[];
  r: number[];
  v: number[];
}

interface Artifact {
  model_type: string;
  n_estimators: number;
  max_depth: number;
  target: string;
  feature_names: string[];
  feature_importance: { feature: string; importance: number }[];
  training_timestamp: string;
  metrics: {
    dataset_size: number;
    training_records: number;
    testing_records: number;
    mae: number;
    rmse: number;
    r2: number;
    target_column: string;
    dataset_files: string[];
  };
  target_mean: number;
  profiles: {
    hourly: Record<string, number>;
    monthly: Record<string, number>;
    day_of_week: Record<string, number>;
  };
  comparison: { actual: number; predicted: number }[];
  datasets: Record<
    string,
    {
      name: string;
      source: string;
      available: boolean;
      columns: string[];
      shape: number[] | null;
    }
  >;
  owid_series: { year: number; co2: number; co2_per_capita: number | null }[];
  trees: TreeJson[];
}

export const model = artifact as unknown as Artifact;

function predictTree(tree: TreeJson, x: number[]): number {
  let node = 0;
  // -2 marks a leaf in scikit-learn's tree export
  while (tree.f[node] !== -2) {
    const feature = tree.f[node]!;
    node = x[feature]! <= tree.t[node]! ? tree.l[node]! : tree.r[node]!;
  }
  return tree.v[node]!;
}

/** Evaluate the whole forest (mean of tree predictions). */
export function predictVector(x: number[]): number {
  let sum = 0;
  for (const tree of model.trees) sum += predictTree(tree, x);
  return sum / model.trees.length;
}

/**
 * Build the feature vector only when every trained feature has a real value.
 */
export function buildFeatures(input: Record<string, number | null | undefined>) {
  const matched: string[] = [];
  const missing: string[] = [];
  const vector: number[] = [];
  for (const name of model.feature_names) {
    const v = input[name];
    if (typeof v === "number" && Number.isFinite(v)) {
      matched.push(name);
      vector.push(v);
    } else {
      missing.push(name);
    }
  }
  return { vector: missing.length === 0 ? vector : null, matched, missing };
}

export function predictFrom(input: Record<string, number | null | undefined>) {
  const { vector, matched, missing } = buildFeatures(input);
  if (vector === null) {
    throw new Error(`Prediction requires real values for every model feature: ${missing.join(", ")}`);
  }
  return { value: Math.round(predictVector(vector) * 100) / 100, matched, missing };
}

export const hourlyProfile = (hour: number) => model.profiles.hourly[String(hour)] ?? null;
export const monthlyProfile = (month: number) => model.profiles.monthly[String(month)] ?? null;
export const dowProfile = (dow: number) => model.profiles.day_of_week[String(dow)] ?? null;
