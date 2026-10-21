/**
 * CO2 Prediction module — server-only inference.
 *
 * Two independent Random Forests (trained by ml/train_co2_model.py):
 *  - traffic model : Bengaluru traffic patterns -> expected vehicle count
 *  - CO2 model     : India state/year socio-economic data -> annual MtCO2
 * They are combined only here, at prediction time, never merged as data.
 */
import artifact from "./co2-model.json";

interface TreeJson { f: number[]; t: number[]; l: number[]; r: number[]; v: number[] }

type Artifact = typeof artifact;
export const co2Model = artifact as Artifact;

function predictTree(tree: TreeJson, x: number[]): number {
  let n = 0;
  while (tree.f[n] !== -2) n = x[tree.f[n]!]! <= tree.t[n]! ? tree.l[n]! : tree.r[n]!;
  return tree.v[n]!;
}

export function forest(trees: TreeJson[], x: number[]): number {
  if (x.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    throw new Error("Model input incomplete");
  }
  let s = 0;
  for (const t of trees) s += predictTree(t, x);
  return s / trees.length;
}

/** Map OpenWeather "main" condition to the traffic dataset weather classes. */
export function weatherClass(main: string | null | undefined): string | null {
  if (!main) return null;
  const m = main.toLowerCase();
  if (m === "clear") return "Clear";
  if (m === "clouds") return "Cloudy";
  if (["rain", "drizzle", "thunderstorm", "snow"].includes(m)) return "Rainy";
  if (["mist", "fog", "haze", "smoke", "dust", "sand", "ash"].includes(m)) return "Foggy";
  return null;
}

/** Current Indian Standard Time calendar parts. */
export function istParts(now: Date) {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  const dow = ist.getUTCDay(); // 0 = Sunday
  return {
    hour: ist.getUTCHours(),
    dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow]!,
    isWeekend: dow === 0 || dow === 6 ? 1 : 0,
    date: ist.toISOString().slice(0, 10),
  };
}

/**
 * Tier-2 style emission-factor method (EMEP/EEA Guidebook 1.A.3.b structure:
 * E = Σ_k flow × share_k × length × EF_k). This is NOT full COPERT: the ARAI
 * factors are drive-cycle averages, so no speed-dependent correction is applied.
 *
 * EF_k: ARAI (2007) "Emission Factor Development for Indian Vehicles", Table I,
 *       CO2 g/km, most recent vintage rows listed below.
 * share_k: RITES (2007) Comprehensive Traffic & Transportation Plan for Bangalore,
 *       Fig. 3.3, mid-block traffic composition at M G Road (shares normalised).
 */
export const FLEET = [
  { key: "two_wheeler", label: "Two-wheeler", share_pct: 51.74, ef_g_per_km: 24.82, ef_source: "ARAI row 20: motorcycle 4-stroke 100–200 cc, post-2000" },
  { key: "car", label: "Car", share_pct: 24.9, ef_g_per_km: 126.5, ef_source: "ARAI row 37: passenger car petrol 1000–1400 cc, post-2000" },
  { key: "auto", label: "Auto-rickshaw", share_pct: 18.91, ef_g_per_km: 77.7, ef_source: "ARAI row 30: three-wheeler CNG 4-stroke OEM, post-2000" },
  { key: "bus", label: "Bus", share_pct: 3.13, ef_g_per_km: 602.01, ef_source: "ARAI row 59: HCV diesel bus, post-2005" },
  { key: "mini_bus_lcv", label: "Mini-bus / LCV", share_pct: 0.83, ef_g_per_km: 401.25, ef_source: "ARAI row 55: LCV diesel >3000 cc, post-2000" },
] as const;

const SHARE_TOTAL = FLEET.reduce((s, f) => s + f.share_pct, 0);

/** Fleet-weighted CO2 emission factor in g per vehicle-km. */
export function fleetEmissionFactor() {
  return FLEET.reduce((s, f) => s + (f.share_pct / SHARE_TOTAL) * f.ef_g_per_km, 0);
}

export interface Co2Inputs {
  zoneId: number;
  latitude: number;
  longitude: number;
  now: Date;
  currentSpeed: number;  // km/h, live TomTom
  freeFlowSpeed: number; // km/h, live TomTom
  weather: string;       // one of traffic.weather_codes (live OpenWeather)
}

export function estimateCo2(i: Co2Inputs) {
  const tm = co2Model.traffic;
  const t = istParts(i.now);
  const isPeak = tm.peak_hours.includes(t.hour) ? 1 : 0;
  const weatherCode = tm.weather_codes.indexOf(i.weather);
  if (weatherCode < 0) throw new Error("Unsupported weather class");
  if (!(i.currentSpeed > 0) || !(i.freeFlowSpeed > 0)) throw new Error("Invalid traffic speed");
  const zd = (tm.zone_distance as Record<string, { distance_km: number; routes: number; nearest_source: string }>)[String(i.zoneId)];
  if (!zd || !(zd.distance_km > 0)) throw new Error("Zone distance unavailable");

  // 1. ML: predicted hourly vehicle flow for this zone under current conditions.
  const trafficVector = [t.hour, t.isWeekend, isPeak, weatherCode, i.currentSpeed, i.latitude, i.longitude];
  const vehiclesPerHour = forest(tm.trees as TreeJson[], trafficVector);

  // 2. Calculated: vehicle-km/h × per-category ARAI CO2 factors.
  const vkmPerHour = vehiclesPerHour * zd.distance_km;
  const breakdown = FLEET.map((f) => ({
    category: f.label,
    share_pct: round((f.share_pct / SHARE_TOTAL) * 100, 1),
    ef_g_per_km: f.ef_g_per_km,
    kg_per_hour: round((vkmPerHour * (f.share_pct / SHARE_TOTAL) * f.ef_g_per_km) / 1000, 1),
  }));
  const kgPerHour = (vkmPerHour * fleetEmissionFactor()) / 1000;

  return {
    time: { ...t, is_peak: isPeak === 1 },
    expected_vehicles_per_hour: Math.round(vehiclesPerHour),
    congestion_factor: round(Math.max(1, i.freeFlowSpeed / i.currentSpeed), 2),
    zone_distance_km: zd.distance_km,
    zone_distance_routes: zd.routes,
    vehicle_km_per_hour: round(vkmPerHour, 1),
    fleet_ef_g_per_vkm: round(fleetEmissionFactor(), 1),
    breakdown,
    estimated_co2_kg_per_hour: round(kgPerHour, 1),
    traffic_vector: trafficVector,
  };
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
