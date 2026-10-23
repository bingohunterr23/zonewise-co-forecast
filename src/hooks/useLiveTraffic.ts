import { useCallback, useEffect, useRef, useState } from "react";
import { getLiveTrafficFn } from "@/lib/traffic.functions";
import type { LiveTraffic } from "@/lib/traffic/live-traffic.server";

export type { LiveTraffic };

/** Browser-side dedupe: all pages share one in-flight / recent response. */
const CLIENT_TTL_MS = 60 * 1000;
export const TRAFFIC_REFRESH_MS = 5 * 60 * 1000;
/** A reading older than this is flagged as stale. */
export const TRAFFIC_STALE_MS = 10 * 60 * 1000;
let shared: { at: number; pending: boolean; promise: Promise<LiveTraffic[]> } | null = null;

function load(force: boolean) {
  if (shared && (shared.pending || (!force && Date.now() - shared.at < CLIENT_TTL_MS))) return shared.promise;
  const promise = getLiveTrafficFn();
  const entry = { at: Date.now(), pending: true, promise };
  shared = entry;
  promise.finally(() => { entry.pending = false; }).catch(() => {});
  promise.catch(() => { shared = null; });
  return promise;
}

export function useLiveTraffic() {
  const [traffic, setTraffic] = useState<LiveTraffic[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const refresh = useCallback(async (force = false) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const data = await load(force);
      if (id === reqId.current) {
        setTraffic(previous => data.map(next => {
          const old = previous?.find(item => item.zone_id === next.zone_id);
          return next.status !== 'ok' && old?.status === 'ok' ? { ...old, error: next.error, stale: true } : next;
        }));
        setError(data.filter(item => item.error).map(item => item.error).join(' · ') || null);
      }
    } catch (e) {
      if (id === reqId.current) { setTraffic(previous => previous?.map(item => ({ ...item, stale: true })) ?? null); setError("Traffic could not be refreshed; retained readings are stale."); }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => refresh(true), TRAFFIC_REFRESH_MS);
    return () => { clearInterval(t); reqId.current++; };
  }, [refresh]);

  const forZone = useCallback((zoneId: number) => traffic?.find((t) => t.zone_id === zoneId), [traffic]);
  return { traffic, forZone, loading, error, refresh };
}

export function isStale(t: LiveTraffic, now = Date.now()) {
  return Boolean(t.stale || now - new Date(t.fetched_at).getTime() > TRAFFIC_STALE_MS);
}
