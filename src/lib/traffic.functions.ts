import { createServerFn } from "@tanstack/react-start";
import { ZONES_SEED } from "@/types";

/** Live TomTom traffic for all eight zones (shared, cached on the server). */
export const getLiveTrafficFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getZoneTraffic } = await import("./traffic/live-traffic.server");
  return Promise.all(ZONES_SEED.map((z) => getZoneTraffic(z)));
});
