import { isStale, type LiveTraffic } from "@/hooks/useLiveTraffic";

const TONE: Record<string, string> = {
  free: "bg-eco-100 text-eco-700",
  light: "bg-eco-100 text-eco-700",
  moderate: "bg-amber-100 text-amber-700",
  heavy: "bg-clay-100 text-clay-500",
};

export function trafficTime(t: LiveTraffic) {
  return new Date(t.fetched_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

/** Compact live TomTom traffic label. Never falls back to a static category. */
export function LiveTrafficBadge({ t, loading, detailed = false }: { t?: LiveTraffic; loading?: boolean; detailed?: boolean }) {
  if (!t) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-warm-100 text-eco-400">{loading ? "Traffic loading…" : "Traffic unavailable"}</span>;
  }
  const c = t.classification;
  if (t.status !== "ok" || !c) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-warm-100 text-eco-400" title={t.error ?? undefined}>
      {t.road_closure ? "Road closed (TomTom)" : "Traffic unavailable"}
    </span>;
  }
  const stale = isStale(t);
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TONE[c.level]}`}
      title="Live TomTom measurement at the road segment nearest the zone point — not the whole zone">
      {c.label}
      {detailed && <span className="font-normal">· {t.current_speed}/{t.free_flow_speed} km/h ({c.ratioPct}%)</span>}
      <span className="font-normal opacity-75">· {stale ? "stale, " : ""}{trafficTime(t)}</span>
    </span>
  );
}
