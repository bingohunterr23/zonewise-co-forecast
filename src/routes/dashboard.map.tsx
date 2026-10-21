import { createFileRoute } from "@tanstack/react-router";
import { AreaVisualizationPage } from "@/pages/AreaVisualizationPage";

export const Route = createFileRoute("/dashboard/map")({
  head: () => ({
    meta: [
      { title: "Area Visualization — UrbanEcoSense Bengaluru" },
      { name: "description", content: "Interactive map of Bengaluru monitoring zones and live readings." },
      { property: "og:title", content: "Area Visualization — UrbanEcoSense Bengaluru" },
      { property: "og:description", content: "Interactive map of Bengaluru monitoring zones and live readings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AreaVisualizationPage,
});
