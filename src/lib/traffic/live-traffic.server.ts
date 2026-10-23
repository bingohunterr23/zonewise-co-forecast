/**
 * Shared live TomTom traffic service (server-only). One cached request per zone
 * point serves every module, so switching pages never re-hits TomTom within the
 * cache window. Failures are never replaced with static or invented values.
 */
import { requestProviderJson, finiteNumber } from "../provider-request.server";
import { classifyTraffic, type TrafficClassification } from "@/lib/co2/traffic-condition";

export const TRAFFIC_CACHE_MS = 2 * 60 * 1000;

export interface TomTomFlow {
  currentSpeed?: number;
  freeFlowSpeed?: number;
  currentTravelTime?: number;
  freeFlowTravelTime?: number;
  confidence?: number;
  roadClosure?: boolean;
  frc?: string;
}

export interface LiveTraffic {
  stale?: boolean;
  zone_id: number;
  status: "ok" | "unavailable";
  provider: "TomTom Traffic Flow";
  current_speed: number | null;
  free_flow_speed: number | null;
  current_travel_time: number | null;
  free_flow_travel_time: number | null;
  confidence: number | null;
  road_closure: boolean;
  road_class: string | null;
  classification: TrafficClassification | null;
  fetched_at: string;
  error: string | null;
}

type Entry = { at: number; promise: Promise<LiveTraffic> };
const cache = new Map<number, Entry>();

async function request(zone: { id: number; latitude: number; longitude: number }): Promise<LiveTraffic> {
  const fetchedAt = new Date().toISOString();
  const base = {
    zone_id: zone.id, provider: "TomTom Traffic Flow" as const, fetched_at: fetchedAt,
    current_speed: null, free_flow_speed: null, current_travel_time: null, free_flow_travel_time: null,
    confidence: null, road_closure: false, road_class: null, classification: null,
  };
  const key = process.env["TOMTOM_API_KEY"]?.trim();
  if (!key) return { ...base, status: "unavailable", error: "Traffic API key not configured" };
  try {
    const response = await requestProviderJson<{ flowSegmentData?: TomTomFlow }>(
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${zone.latitude},${zone.longitude}&unit=KMPH&key=${key}`,
      'TomTom traffic',
    );
    const flow = response.flowSegmentData;
    if (!flow || finiteNumber(flow.currentSpeed) === null || finiteNumber(flow.freeFlowSpeed) === null ||
        typeof flow.currentSpeed !== 'number' || typeof flow.freeFlowSpeed !== 'number' || flow.currentSpeed < 0 || flow.freeFlowSpeed <= 0) {
      return { ...base, status: "unavailable", error: "TomTom traffic: malformed or empty flow response." };
    }
    return {
      ...base,
      status: "ok",
      current_speed: flow.currentSpeed,
      free_flow_speed: flow.freeFlowSpeed,
      current_travel_time: flow.currentTravelTime ?? null,
      free_flow_travel_time: flow.freeFlowTravelTime ?? null,
      confidence: flow.confidence ?? null,
      road_closure: flow.roadClosure ?? false,
      road_class: flow.frc ?? null,
      classification: flow.roadClosure ? null : classifyTraffic(flow.currentSpeed, flow.freeFlowSpeed),
      error: flow.roadClosure ? "road closed" : null,
    };
  } catch (e) {
    return { ...base, status: "unavailable", error: (e as Error).message };
  }
}

export function getZoneTraffic(zone: { id: number; latitude: number; longitude: number }): Promise<LiveTraffic> {
  const hit = cache.get(zone.id);
  if (hit && Date.now() - hit.at < TRAFFIC_CACHE_MS) return hit.promise;
  const promise = request(zone).then((r) => {
    if (r.status !== "ok") cache.delete(zone.id); // don't keep failures
    return r;
  });
  cache.set(zone.id, { at: Date.now(), promise });
  return promise;
}
