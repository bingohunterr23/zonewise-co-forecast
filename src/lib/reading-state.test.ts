import { describe, expect, it } from 'vitest';
import { averageAqi, mergeReadings, readingIsStale } from './reading-state';
import type { LiveReading } from '@/types';
const reading = (overrides: Partial<LiveReading>): LiveReading => ({ zone_id: 1, zone_name: 'Silk Board', region: 'Silk Board Region', traffic_category: '', latitude: 12.9177, longitude: 77.623, temperature: 24, humidity: 70, pressure: 1010, wind_speed: 2, cloud_coverage: 30, aqi: 2, aqi_category: 'Fair', co: 400, no2: 10, o3: 20, pm2_5: 9, pm10: 12, source: 'openweather', fetched_at: '2026-10-23T04:30:00Z', ...overrides });
describe('real last-success readings', () => {
  it('retains prior values with original timestamp and stale label after a partial failure', () => {
    const old = reading({});
    const next = reading({ temperature: null, weather_error: 'timeout', fetched_at: '2026-10-23T04:35:00Z', pm2_5: 11 });
    const result = mergeReadings([old], [next])[0];
    expect(result.temperature).toBe(24);
    expect(result.pm2_5).toBe(11);
    expect(result.fetched_at).toBe(old.fetched_at);
    expect(result.stale).toBe(true);
  });
  it('never borrows data from another zone', () => {
    expect(mergeReadings([reading({ zone_id: 1 })], [reading({ zone_id: 2, temperature: null })])[0].temperature).toBeNull();
  });
  it('returns no AQI rather than misleading zero for missing values', () => {
    expect(averageAqi([reading({ aqi: null })])).toBeNull();
    expect(averageAqi([reading({ aqi: 2 }), reading({ aqi: 4 })])).toBe(3);
  });
  it('flags expired data rather than presenting it as live', () => {
    expect(readingIsStale(reading({}), Date.parse('2026-10-23T04:41:00Z'))).toBe(true);
    expect(readingIsStale(reading({}), Date.parse('2026-10-23T04:31:00Z'))).toBe(false);
  });
});