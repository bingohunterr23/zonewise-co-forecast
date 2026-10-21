import { describe, expect, it } from "vitest";
import { estimateCo2, fleetEmissionFactor, FLEET } from "./co2.server";

const base = { zoneId: 1, latitude: 12.9177, longitude: 77.623, now: new Date("2026-10-09T05:00:00Z"), currentSpeed: 20, freeFlowSpeed: 40, weather: "Clear" };

describe("CO2 estimate", () => {
  it("uses the ARAI factors and RITES mix (fleet average ≈ 81.6 g/veh-km)", () => {
    expect(FLEET.find((f) => f.key === "car")!.ef_g_per_km).toBe(126.5);
    expect(fleetEmissionFactor()).toBeCloseTo(81.6, 0);
  });

  it("kg/h = vehicles/h × link km × fleet factor ÷ 1000", () => {
    const r = estimateCo2(base);
    const expected = (r.vehicle_km_per_hour * fleetEmissionFactor()) / 1000;
    expect(r.estimated_co2_kg_per_hour).toBeCloseTo(expected, 0);
  });

  it("produces an estimate for all eight zones with distinct link lengths", () => {
    const d = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((z) => estimateCo2({ ...base, zoneId: z }).zone_distance_km));
    expect(d.size).toBeGreaterThan(1);
  });

  it("refuses missing or invalid live inputs instead of inventing values", () => {
    expect(() => estimateCo2({ ...base, weather: "Unknown" })).toThrow();
    expect(() => estimateCo2({ ...base, currentSpeed: 0 })).toThrow();
    expect(() => estimateCo2({ ...base, zoneId: 99 })).toThrow();
  });
});
