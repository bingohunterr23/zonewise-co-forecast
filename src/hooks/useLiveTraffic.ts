import { useCallback, useEffect, useRef, useState } from "react";
import { getLiveTrafficFn } from "@/lib/traffic.functions";
import type { LiveTraffic } from "@/lib/traffic/live-traffic.server";

export type { LiveTraffic };

/** Browser-side dedupe: all pages share one in-flight / recent response. */
const CLIENT_TTL_MS = 60 * 1000;
export const TRAFFIC_REFRESH_MS = 5 * 60 * 1000;
/** A reading older than this is flagged as stale. */
export const TRAFFIC_STALE_MS = 10 * 60 * 1000;
let shared: { at: number; promise: Promise<LiveTraffic[]> } | null = null;

function load(force: boolean) {
  if (!force && shared && Date.now() - shared.at < CLIENT_TTL_MS) return shared.promise;
  const promise = getLiveTrafficFn();
  shared = { at: Date.now(), promise };
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
      if (id === reqId.current) { setTraffic(data); setError(null); }
    } catch (e) {
      if (id === reqId.current) { setTraffic(null); setError((e as Error).message); }
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
  return now - new Date(t.fetched_at).getTime() > TRAFFIC_STALE_MS;
}
