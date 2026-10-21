/**
 * UrbanEcoSense server functions — the backend of the app.
 *
 * Replaces the old external FastAPI service:
 *  - live weather / air quality  -> OpenWeather (key read from env, server-side only)
 *  - CO2 prediction              -> trained Random Forest artifact (ml/train_model.py)
 *  - green cover                 -> bundled ESA WorldCover / Sentinel-2 dataset
 */
import { createServerFn } from "@tanstack/react-start";
import { ZONES_SEED } from "@/types";

const AQI_CATEGORIES = ["Good", "Fair", "Moderate", "Poor", "Very Poor"];

/**
 * Resilient OpenWeather fetch.
 * Free-tier keys are rate limited (HTTP 429) and occasionally return 5xx; when
 * all 8 zones fire 16 requests at once some zones used to fail, which is why a
 * few zones showed "Unavailable" while others worked. Each request now retries
 * with backoff and every zone/endpoint is isolated from the others.
 */
async function fetchJson<T>(url: string, label: string, attempts = 3): Promise<T> {
  let lastError = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as T;
      const detail = (await res.text()).slice(0, 160);
      lastError = `${label} HTTP ${res.status}: ${detail}`;
      // 4xx other than 429 will not fix itself — fail fast.
      if (res.status !== 429 && res.status < 500) break;
    } catch (err) {
      lastError = `${label} network error: ${(err as Error).message}`;
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw new Error(lastError || `${label} failed`);
}

/** Run tasks with limited concurrency so we never burst the OpenWeather limit. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return out;
}

type ZoneReading = {
  zone_id: number;
  zone_name: string;
  region: string;
  traffic_category: string;
  latitude: number;
  longitude: number;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  wind_speed: number | null;
  cloud_coverage: number | null;
  aqi: number | null;
  aqi_category: string | null;
  co: number | null;
  no: number | null;
  no2: number | null;
  o3: number | null;
  pm2_5: number | null;
  pm10: number | null;
  source: string;
  fetched_at: string | null;
  error: string | null;
  weather_error?: string | null;
  air_error?: string | null;
};

async function fetchZoneReading(
  zone: (typeof ZONES_SEED)[number],
  apiKey: string,
): Promise<ZoneReading> {
  const base = {
    zone_id: zone.id,
    zone_name: zone.name,
    region: zone.region,
    traffic_category: zone.traffic_category,
    latitude: zone.latitude,
    longitude: zone.longitude,
  };

  // The two endpoints are independent: a failure of one must not blank the other.
  const [weatherResult, airResult] = await Promise.allSettled([
    fetchJson<{
      main?: { temp?: number; humidity?: number; pressure?: number };
      wind?: { speed?: number };
      clouds?: { all?: number };
    }>(
      `https://api.openweathermap.org/data/2.5/weather?lat=${zone.latitude}&lon=${zone.longitude}&units=metric&appid=${apiKey}`,
      `weather[zone ${zone.id} ${zone.name}]`,
    ),
    fetchJson<{ list?: { main?: { aqi?: number }; components?: Record<string, number> }[] }>(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${zone.latitude}&lon=${zone.longitude}&appid=${apiKey}`,
      `air_pollution[zone ${zone.id} ${zone.name}]`,
    ),
  ]);

  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const weatherError =
    weatherResult.status === "rejected" ? (weatherResult.reason as Error).message : null;
  const air = airResult.status === "fulfilled" ? airResult.value : null;
  const airError = airResult.status === "rejected" ? (airResult.reason as Error).message : null;

  if (weatherError) console.error(`[UrbanEcoSense] ${weatherError}`);
  if (airError) console.error(`[UrbanEcoSense] ${airError}`);

  const entry = air?.list?.[0];
  const comp = entry?.components ?? {};
  const aqi = entry?.main?.aqi ?? null;
  const hasAny = weather != null || air != null;

  const reading: ZoneReading = {
    ...base,
    temperature: weather?.main?.temp ?? null,
    humidity: weather?.main?.humidity ?? null,
    pressure: weather?.main?.pressure ?? null,
    wind_speed: weather?.wind?.speed ?? null,
    cloud_coverage: weather?.clouds?.all ?? null,
    aqi,
    aqi_category: aqi ? (AQI_CATEGORIES[aqi - 1] ?? null) : null,
    co: comp["co"] ?? null,
    no: comp["no"] ?? null,
    no2: comp["no2"] ?? null,
    o3: comp["o3"] ?? null,
    pm2_5: comp["pm2_5"] ?? null,
    pm10: comp["pm10"] ?? null,
    source: hasAny ? "openweather" : "unavailable",
    fetched_at: new Date().toISOString(),
    error: [weatherError, airError].filter(Boolean).join(" | ") || null,
    weather_error: weatherError,
    air_error: airError,
  };

  return reading;
}

/**
 * No silent fallback provider. The previous Open-Meteo fallback used a ~0.1°
 * air-quality grid, so every zone received the *same* NO/NO2 values and the
 * Random Forest (dominated by NOx) returned the same CO2 for all zones.
 * Without an OpenWeather key the zone is reported as unavailable instead.
 */
function unavailableReading(zone: (typeof ZONES_SEED)[number], reason: string): ZoneReading {
  return {
    zone_id: zone.id, zone_name: zone.name, region: zone.region,
    traffic_category: zone.traffic_category, latitude: zone.latitude, longitude: zone.longitude,
    temperature: null, humidity: null, pressure: null, wind_speed: null, cloud_coverage: null,
    aqi: null, aqi_category: null, co: null, no: null, no2: null, o3: null, pm2_5: null, pm10: null,
    source: "unavailable", fetched_at: null, error: reason, weather_error: reason, air_error: reason,
  };
}

async function fetchLiveReading(zone: (typeof ZONES_SEED)[number], apiKey: string | null) {
  if (!apiKey) {
    console.error(`[UrbanEcoSense] zone ${zone.id} ${zone.name}: OPENWEATHER_API_KEY not configured`);
    return unavailableReading(zone, "OpenWeather API key not configured");
  }
  return fetchZoneReading(zone, apiKey);
}

/**
 * Unit bridge between OpenWeather and the training data.
 *  - OpenWeather NO2 is µg/m³, exactly like UCI `NO2(GT)` → passed through.
 *  - UCI `NOx(GT)` is in ppb, so live NO + NO2 (µg/m³) are converted to ppb
 *    at 25 °C / 1 atm:  ppb = µg/m³ × 24.45 / molar-mass.
 */
export function noxPpb(no: number | null, no2: number | null): number | null {
  if (no == null || no2 == null) return null;
  const a = (no * 24.45) / 30.01;
  const b = (no2 * 24.45) / 46.01;
  return Math.round((a + b) * 100) / 100;
}


function readApiKey(): string | null {
  return process.env["OPENWEATHER_API_KEY"] || null;
}

export const getZonesFn = createServerFn({ method: "GET" }).handler(async () => ZONES_SEED);

export const getLiveReadingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const key = readApiKey();
  return mapLimit([...ZONES_SEED], 4, (z) => fetchLiveReading(z, key));
});

export const getLiveReadingFn = createServerFn({ method: "GET" })
  .inputValidator((data: { zoneId: number }) => data)
  .handler(async ({ data }) => {
    const zone = ZONES_SEED.find((z) => z.id === data.zoneId);
    if (!zone) throw new Error(`Unknown zone ${data.zoneId}`);
    const key = readApiKey();
    return fetchLiveReading(zone, key);
  });

export const getModelStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const { model } = await import("./ml/model.server");
  return {
    available: true,
    model_type: `${model.model_type} (${model.n_estimators} trees, max_depth ${model.max_depth})`,
    target: model.target,
    has_temporal_data: true,
    training_timestamp: model.training_timestamp,
    message: null,
  };
});

export const getModelMetricsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { model } = await import("./ml/model.server");
  return model.metrics;
});

export const getModelFeaturesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { model } = await import("./ml/model.server");
  return {
    feature_names: model.feature_names,
    feature_importance: model.feature_importance,
    target_column: model.target,
  };
});

export const getDatasetsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { model } = await import("./ml/model.server");
  const primary = model.datasets["primary"]!;
  const owid = model.datasets["owid"]!;
  return {
    chetna: {
      name: primary.name,
      source: primary.source,
      available: primary.available,
      columns: primary.columns,
      shape: primary.shape,
    },
    kaggle: {
      name: owid.name,
      source: owid.source,
      available: owid.available,
      columns: owid.columns,
      shape: owid.shape,
    },
    kaggle_url: "https://github.com/owid/co2-data",
    kaggle_instructions:
      "Bundled with the project at ml/datasets/owid-co2-india.csv — no API key required.",
    owid_series: model.owid_series,
  };
});

export const predictCo2Fn = createServerFn({ method: "POST" })
  .inputValidator((data: { features: Record<string, number> }) => data)
  .handler(async ({ data }) => {
    const { predictFrom, model } = await import("./ml/model.server");
    const { value } = predictFrom(data.features);
    return {
      predicted_co2: value,
      model_name: model.model_type,
      feature_names: model.feature_names,
    };
  });

/**
 * Feature-mapping layer: live OpenWeather measurements -> the exact feature
 * vector the Random Forest was trained on. Only real measured values are used;
 * anything the API could not supply is reported back as a missing feature.
 */
function featuresFromReading(
  reading: {
    temperature: number | null;
    humidity: number | null;
    no2: number | null;
    no: number | null;
  },
  when: Date = new Date(),
) {
  // Calendar features in Indian Standard Time (UTC+5:30, no DST), matching
  // the local-clock convention of the training timestamps.
  const ist = new Date(when.getTime() + 330 * 60 * 1000);
  return {
    temperature: reading.temperature,
    humidity: reading.humidity,
    no2: reading.no2,
    nox: noxPpb(reading.no, reading.no2),
    hour: ist.getUTCHours(),
    month: ist.getUTCMonth() + 1,
    day_of_week: (ist.getUTCDay() + 6) % 7,
  };
}

function zonePrediction(
  reading: Awaited<ReturnType<typeof fetchZoneReading>>,
  predictFrom: typeof import("./ml/model.server")["predictFrom"],
  buildFeatures: typeof import("./ml/model.server")["buildFeatures"],
  featureNames: string[],
  modelType: string,
) {
  const inputs = featuresFromReading(reading);
  const { vector, matched, missing } = buildFeatures(inputs);
  const inputFeatures = Object.fromEntries(
    featureNames.map((name) => [name, inputs[name as keyof typeof inputs] ?? null]),
  );
  const liveEmissionMeasurements = {
    co: reading.co,
    no: reading.no,
    no2: reading.no2,
    o3: reading.o3,
    pm2_5: reading.pm2_5,
    pm10: reading.pm10,
    aqi: reading.aqi,
  };
  if (reading.source === "unavailable" || vector === null) {
    console.info("[UrbanEcoSense:prediction]", JSON.stringify({
      zone_id: reading.zone_id,
      zone_name: reading.zone_name,
      coordinates: { latitude: reading.latitude, longitude: reading.longitude },
      provider: reading.source,
      live_emission_measurements: liveEmissionMeasurements,
      model_feature_order: featureNames,
      input_features: inputFeatures,
      model_input_vector: vector,
      matched_features: matched,
      missing_features: missing,
      prediction: null as number | null,
    }));
    return {
      zone_id: reading.zone_id,
      zone_name: reading.zone_name,
      predicted_co2: null,
      model: modelType,
      prediction_type: "unavailable",
      matched_features: matched,
      missing_features: missing,
      live_reading: reading,
      message: missing.length > 0
        ? `Prediction unavailable; live values are missing for: ${missing.join(", ")}.`
        : "Live data currently unavailable.",
    };
  }
  const result = predictFrom(inputs);
  console.info("[UrbanEcoSense:prediction]", JSON.stringify({
    zone_id: reading.zone_id,
    zone_name: reading.zone_name,
    coordinates: { latitude: reading.latitude, longitude: reading.longitude },
    provider: reading.source,
    live_emission_measurements: liveEmissionMeasurements,
    model_feature_order: featureNames,
    input_features: inputFeatures,
    model_input_vector: vector,
    matched_features: matched,
    missing_features: missing,
    prediction: result.value,
  }));
  return {
    zone_id: reading.zone_id,
    zone_name: reading.zone_name,
    predicted_co2: result.value,
    model: modelType,
    prediction_type: "ml_estimate",
    matched_features: matched,
    missing_features: missing,
    live_reading: reading,
    message: null,
  };
}

export const predictZonesFn = createServerFn({ method: "GET" }).handler(async () => {
  const key = readApiKey();
  const { predictFrom, buildFeatures, model } = await import("./ml/model.server");
  const readings = await mapLimit([...ZONES_SEED], 4, (z) => fetchLiveReading(z, key));
  const results = readings.map((r) => zonePrediction(r, predictFrom, buildFeatures, model.feature_names, model.model_type));
  // Debug aid: flag zones whose live inputs are byte-identical (the API returned
  // the same grid cell), which is the only way two zones can share a prediction.
  const byInput = new Map<string, number[]>();
  for (const r of readings) {
    const key = JSON.stringify(featuresFromReading(r));
    byInput.set(key, [...(byInput.get(key) ?? []), r.zone_id]);
  }
  for (const [features, zones] of byInput) {
    if (zones.length > 1) console.warn("[UrbanEcoSense:prediction] identical live inputs for zones", zones, features);
  }
  console.info("[UrbanEcoSense:prediction:summary]", JSON.stringify(results.map((r) => ({ zone_id: r.zone_id, predicted_co2: r.predicted_co2 }))));
  return results;
});

export const predictZoneFn = createServerFn({ method: "GET" })
  .inputValidator((data: { zoneId: number }) => data)
  .handler(async ({ data }) => {
    const key = readApiKey();
    const { predictFrom, buildFeatures, model } = await import("./ml/model.server");
    const zone = ZONES_SEED.find((z) => z.id === data.zoneId);
    if (!zone) throw new Error(`Unknown zone ${data.zoneId}`);
    const reading = await fetchLiveReading(zone, key);
    return zonePrediction(reading, predictFrom, buildFeatures, model.feature_names, model.model_type);
  });

export const getGreenCoverFn = createServerFn({ method: "GET" }).handler(async () => {
  const { ZONE_LAND_COVER, GREEN_COVER_PROVIDER } = await import("./green-cover-data");
  return {
    provider: GREEN_COVER_PROVIDER,
    configured: true,
    setup_message: null as string | null,
    zones: ZONES_SEED.map((z) => {
      const lc = ZONE_LAND_COVER.find((l) => l.zone_id === z.id)!;
      return {
        zone_id: z.id,
        zone_name: z.name,
        region: z.region,
        latitude: z.latitude,
        longitude: z.longitude,
        green_cover_percentage:
          Math.round((lc.tree_cover_pct + lc.grassland_pct + lc.cropland_pct) * 10) / 10,
        ndvi: lc.ndvi,
        source: "ESA WorldCover 10m v200 (2021), 1 km buffer",
        configured: true,
      };
    }),
  };
});

export const getHealthFn = createServerFn({ method: "GET" }).handler(async () => ({
  status: "ok",
  model_ready: true,
  database: "local-dataset",
  weather_api: process.env["OPENWEATHER_API_KEY"] ? "configured" : "missing",
}));
