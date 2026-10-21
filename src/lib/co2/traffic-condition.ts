/**
 * Shared traffic classification used by every module (CO₂ Prediction, Live
 * Monitoring, Area Visualization, Dashboard Home).
 *
 * TomTom's freeFlowSpeed is the typical uncongested speed of THAT segment, so
 * the ratio says how congested it is relative to normal; absolute speed is
 * reported separately so a slow road is never called "free-flowing" without
 * qualification. Congestion (ratio bands) and speed (absolute bands) are
 * classified independently.
 */
export type CongestionLevel = "free" | "light" | "moderate" | "heavy";

export interface TrafficClassification {
  level: CongestionLevel;
  congestion: "Free-flowing" | "Light congestion" | "Moderate congestion" | "Heavy congestion";
  speed: "slow" | "moderate speed" | "fast-moving";
  ratioPct: number;
  label: string;
}

export function classifyTraffic(currentSpeed: number, freeFlowSpeed: number): TrafficClassification | null {
  if (!(currentSpeed >= 0) || !(freeFlowSpeed > 0)) return null;
  const ratio = currentSpeed / freeFlowSpeed;
  const level: CongestionLevel = ratio >= 0.9 ? "free" : ratio < 0.5 ? "heavy" : ratio < 0.75 ? "moderate" : "light";
  const congestion = ({
    free: "Free-flowing", light: "Light congestion", moderate: "Moderate congestion", heavy: "Heavy congestion",
  } as const)[level];
  const speed = currentSpeed < 25 ? "slow" : currentSpeed < 40 ? "moderate speed" : "fast-moving";
  return { level, congestion, speed, ratioPct: Math.round(ratio * 100), label: `${congestion} · ${speed}` };
}

export function trafficCondition(currentSpeed: number, freeFlowSpeed: number): string | null {
  return classifyTraffic(currentSpeed, freeFlowSpeed)?.label ?? null;
}
