import type { LiveReading } from '@/types';

export const READING_MAX_AGE_MS = 10 * 60 * 1000;
const WEATHER = ['temperature', 'humidity', 'pressure', 'wind_speed', 'cloud_coverage'] as const;
const AIR = ['aqi', 'co', 'no', 'no2', 'o3', 'pm2_5', 'pm10'] as const;
export function readingIsStale(reading: LiveReading, now = Date.now()) {
  return Boolean(reading.stale || !reading.fetched_at || now - Date.parse(reading.fetched_at) > READING_MAX_AGE_MS);
}
export function mergeReadings(previous: LiveReading[], incoming: LiveReading[]) {
  return incoming.map(next => {
    const old = previous.find(item => item.zone_id === next.zone_id);
    if (!old) return next;
    const result = { ...next };
    let retained = false;
    for (const key of [...WEATHER, ...AIR]) {
      if (next[key] == null && old[key] != null) {
        Object.assign(result, { [key]: old[key] });
        retained = true;
      }
    }
    if (retained) {
      result.aqi_category = next.aqi_category ?? old.aqi_category;
      result.stale = true;
      result.fetched_at = old.fetched_at; // conservatively label entire mixed card by oldest retained reading
    }
    return result;
  });
}
export function averageAqi(readings: LiveReading[]) {
  const values = readings.map(item => item.aqi).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}