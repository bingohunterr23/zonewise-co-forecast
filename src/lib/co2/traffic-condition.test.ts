import { describe, expect, it } from "vitest";
import { trafficCondition } from "./traffic-condition";

describe("traffic condition label", () => {
  it("calls a road at its free-flow speed Free-flowing (Silk Board Junction: 42 vs 42 km/h)", () => {
    expect(trafficCondition(42, 42)).toBe("Free-flowing · fast-moving");
  });
  it("never calls a 20 km/h road free-flowing (HSR Layout: 20 vs 24 km/h)", () => {
    expect(trafficCondition(20, 24)).toBe("Light congestion · slow");
  });
  it("flags moderate congestion between half and three-quarters of free-flow (16 vs 24 km/h)", () => {
    expect(trafficCondition(16, 24)).toBe("Moderate congestion · slow");
  });
  it("flags heavy congestion below half the free-flow speed", () => {
    expect(trafficCondition(10, 40)).toBe("Heavy congestion · slow");
  });
  it("returns null when TomTom data is invalid", () => {
    expect(trafficCondition(20, 0)).toBeNull();
  });
});
