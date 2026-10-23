import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyTraffic } from "@/lib/co2/traffic-condition";

const zone = (id: number) => ({ id, latitude: 12.9, longitude: 77.6 });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("shared traffic classification", () => {
  it("Silk Board 42/42 km/h is free-flowing at 100%", () => {
    const c = classifyTraffic(42, 42)!;
    expect(c.level).toBe("free");
    expect(c.ratioPct).toBe(100);
  });
  it("HSR Layout 20/24 km/h is light congestion, slow, 83%", () => {
    const c = classifyTraffic(20, 24)!;
    expect(c.label).toBe("Light congestion · slow");
    expect(c.ratioPct).toBe(83);
  });
});

describe("shared live TomTom service", () => {
  it("is unavailable (no fabricated speeds) without an API key", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "");
    const { getZoneTraffic } = await import("./live-traffic.server");
    const t = await getZoneTraffic(zone(1));
    expect(t.status).toBe("unavailable");
    expect(t.current_speed).toBeNull();
    expect(t.classification).toBeNull();
  });
  it("is unavailable on an HTTP error", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 429 })));
    const { getZoneTraffic } = await import("./live-traffic.server");
    const t = await getZoneTraffic(zone(2));
    expect(t.status).toBe("unavailable");
    expect(t.error).toContain("HTTP 429");
  });
  it("calls TomTom only once per zone within the cache window", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "k");
    const f = vi.fn(async () => Response.json({ flowSegmentData: { currentSpeed: 20, freeFlowSpeed: 24 } }));
    vi.stubGlobal("fetch", f);
    const { getZoneTraffic } = await import("./live-traffic.server");
    const a = await getZoneTraffic(zone(3));
    const b = await getZoneTraffic(zone(3));
    expect(f).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a.classification?.label).toBe("Light congestion · slow");
  });
});
