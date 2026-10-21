import { createFileRoute } from "@tanstack/react-router";
import { LiveMonitoringPage } from "@/pages/LiveMonitoringPage";

export const Route = createFileRoute("/dashboard/live")({
  head: () => ({
    meta: [
      { title: "Live Monitoring — UrbanEcoSense Bengaluru" },
      { name: "description", content: "Real-time OpenWeather air quality and weather across 8 Bengaluru zones." },
      { property: "og:title", content: "Live Monitoring — UrbanEcoSense Bengaluru" },
      { property: "og:description", content: "Real-time OpenWeather air quality and weather across 8 Bengaluru zones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveMonitoringPage,
});
