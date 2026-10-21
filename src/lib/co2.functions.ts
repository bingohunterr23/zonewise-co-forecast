/**
 * CO2 Prediction module server functions (live traffic + weather -> RF estimate).
 * Never returns a fabricated CO2 value: any missing live input => unavailable.
 */
import { createServerFn } from "@tanstack/react-start";
import { ZONES_SEED } from "@/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const getCo2ModelInfoFn = createServerFn({ method: "GET" }).handler(async () => {
  const { co2Model } = await import("./co2/co2.server");
  const { traffic, co2 } = co2Model;
  return {
    trained_at: co2Model.trained_at,
    traffic: {
      dataset: traffic.dataset, target: traffic.target, metrics: traffic.metrics,
      feature_importance: traffic.feature_importance, peak_hours: traffic.peak_hours,
      hourly_profile: traffic.hourly_profile,
    },
    co2: {
      dataset: co2.dataset, target: co2.target, metrics: co2.metrics,
      feature_importance: co2.feature_importance, karnataka_latest: co2.karnataka_latest,
    },
    configured: {
      openweather: Boolean(process.env["OPENWEATHER_API_KEY"]),
      traffic: Boolean(process.env["TOMTOM_API_KEY"]),
    },
  };
});

export const predictLocationCo2Fn = createServerFn({ method: "GET" })
  .inputValidator((data: { zoneId: number }) => data)
  .handler(async ({ data }) => {
    const zone = ZONES_SEED.find((z) => z.id === data.zoneId);
    if (!zone) throw new Error("Unknown location");
    const now = new Date();
    const owKey = process.env["OPENWEATHER_API_KEY"];
    const ttKey = process.env["TOMTOM_API_KEY"];
    const { estimateCo2, weatherClass, istParts, co2Model } = await import("./co2/co2.server");
    const { getZoneTraffic } = await import("./traffic/live-traffic.server");

    const [trafficRes, weatherRes, airRes] = await Promise.allSettled([
      ttKey
        ? getZoneTraffic(zone).then((t) => {
            if (t.status !== "ok" && !t.road_closure) throw new Error(t.error ?? "no flow data");
            return t;
          })
        : Promise.reject(new Error("Traffic API key not configured")),
      owKey
        ? getJson<{ weather?: { main?: string; description?: string }[]; main?: { temp?: number; humidity?: number }; wind?: { speed?: number } }>(
            `https://api.openweathermap.org/data/2.5/weather?lat=${zone.latitude}&lon=${zone.longitude}&units=metric&appid=${owKey}`)
        : Promise.reject(new Error("OpenWeather API key not configured")),
      owKey
        ? getJson<{ list?: { main?: { aqi?: number }; components?: Record<string, number> }[] }>(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${zone.latitude}&lon=${zone.longitude}&appid=${owKey}`)
        : Promise.reject(new Error("OpenWeather API key not configured")),
    ]);
    const airEntry = airRes.status === "fulfilled" ? airRes.value.list?.[0] ?? null : null;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const air = airEntry
      ? {
          provider: "OpenWeather Air Pollution",
          aqi: num(airEntry.main?.aqi),
          pm2_5: num(airEntry.components?.["pm2_5"]),
          pm10: num(airEntry.components?.["pm10"]),
          no2: num(airEntry.components?.["no2"]),
          co: num(airEntry.components?.["co"]),
          o3: num(airEntry.components?.["o3"]),
          so2: num(airEntry.components?.["so2"]),
          no: num(airEntry.components?.["no"]),
          nh3: num(airEntry.components?.["nh3"]),
        }
      : null;

    const flow = trafficRes.status === "fulfilled" ? trafficRes.value : null;
    const w = weatherRes.status === "fulfilled" ? weatherRes.value : null;
    const traffic = flow && flow.current_speed !== null && flow.free_flow_speed !== null
      ? {
          provider: "TomTom Traffic Flow",
          current_speed: flow.current_speed,
          free_flow_speed: flow.free_flow_speed,
          current_travel_time: flow.current_travel_time,
          free_flow_travel_time: flow.free_flow_travel_time,
          confidence: flow.confidence,
          road_closure: flow.road_closure,
          fetched_at: flow.fetched_at,
        }
      : null;
    const wClass = weatherClass(w?.weather?.[0]?.main);
    const weather = w && wClass
      ? {
          provider: "OpenWeather",
          condition: w.weather?.[0]?.main ?? null,
          description: w.weather?.[0]?.description ?? null,
          model_class: wClass,
          temperature: w.main?.temp ?? null,
          humidity: w.main?.humidity ?? null,
          wind_speed: w.wind?.speed ?? null,
        }
      : null;

    const errors = [
      trafficRes.status === "rejected" ? `Traffic: ${(trafficRes.reason as Error).message}` : !traffic ? "Traffic: no flow data" : null,
      weatherRes.status === "rejected" ? `Weather: ${(weatherRes.reason as Error).message}` : !weather ? "Weather: no usable condition" : null,
      !air ? `Air quality: ${airRes.status === "rejected" ? (airRes.reason as Error).message : "no data"}` : null,
    ].filter(Boolean) as string[];

    let prediction: ReturnType<typeof estimateCo2> | null = null;
    if (traffic && weather && !traffic.road_closure) {
      try {
        prediction = estimateCo2({
          zoneId: zone.id, latitude: zone.latitude, longitude: zone.longitude, now,
          currentSpeed: traffic.current_speed, freeFlowSpeed: traffic.free_flow_speed,
          weather: weather.model_class,
        });
      } catch (e) {
        errors.push(`Model: ${(e as Error).message}`);
      }
    } else if (traffic?.road_closure) errors.push("Traffic: road closed");

    console.info("[UrbanEcoSense:co2]", JSON.stringify({
      zone_id: zone.id,
      zone_name: zone.name,
      coordinates: { latitude: zone.latitude, longitude: zone.longitude },
      model_feature_order: co2Model.traffic.feature_names,
      model_input_features: prediction
        ? Object.fromEntries(co2Model.traffic.feature_names.map((n, i) => [n, prediction!.traffic_vector[i]]))
        : null,
      live_inputs: { current_speed: traffic?.current_speed ?? null, free_flow_speed: traffic?.free_flow_speed ?? null, weather: weather?.model_class ?? null },
      predicted_vehicles_per_hour: prediction?.expected_vehicles_per_hour ?? null,
      prediction_co2_kg_per_hour: prediction?.estimated_co2_kg_per_hour ?? null,
      air,
      errors,
    }));
    return {
      location: { id: zone.id, name: zone.name, region: zone.region, latitude: zone.latitude, longitude: zone.longitude },
      time: istParts(now),
      timestamp: now.toISOString(),
      traffic,
      weather,
      air,
      prediction,
      errors,
    };
  });
