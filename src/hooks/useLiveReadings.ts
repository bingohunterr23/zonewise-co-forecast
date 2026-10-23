import { useCallback, useEffect, useRef, useState } from 'react';
import { liveApi } from '@/services/api';
import { ZONES_SEED, type LiveReading } from '@/types';
import { mergeReadings } from '@/lib/reading-state';

const STORAGE_KEY = 'ues:last-success-readings:v1';
let pending: Promise<LiveReading[]> | null = null;
function load() {
  if (pending) return pending;
  pending = liveApi.getAllReadings().finally(() => { pending = null; });
  return pending;
}

export function useLiveReadings() {
  const [readings, setReadings] = useState<LiveReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const active = useRef(false);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const incoming = await load();
      if (!active.current) return;
      setReadings(previous => {
        const merged = mergeReadings(previous, incoming);
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* storage is optional */ }
        return merged;
      });
      setError([...new Set(incoming.map(item => item.error).filter(Boolean))].join(' · '));
    } catch {
      if (!active.current) return;
      setReadings(previous => previous.map(item => ({ ...item, stale: true })));
      setError('Live readings could not be refreshed. Last successful readings are stale; try Refresh again.');
    } finally {
      busy.current = false;
      if (active.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    active.current = true;
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      if (Array.isArray(saved)) {
        const valid = saved.filter(item => item && typeof item.zone_id === 'number' && typeof item.fetched_at === 'string' && ZONES_SEED.some(zone => zone.id === item.zone_id));
        setReadings(valid.map(item => ({ ...item, stale: true })));
      }
    } catch { /* storage is optional */ }
    void refresh();
    const timer = setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => { active.current = false; clearInterval(timer); };
  }, [refresh]);
  const timestamps = readings.flatMap(item => item.fetched_at ? [Date.parse(item.fetched_at)] : []).filter(Number.isFinite);
  return { zones: ZONES_SEED, readings, loading, error, fetchData: refresh, lastUpdated: timestamps.length ? new Date(Math.min(...timestamps)) : null };
}