import { createFileRoute } from "@tanstack/react-router";
import { GreenCoverPage } from "@/pages/GreenCoverPage";

export const Route = createFileRoute("/dashboard/green-cover")({
  head: () => ({
    meta: [
      { title: "Green Cover — UrbanEcoSense Bengaluru" },
      { name: "description", content: "Satellite land-cover and NDVI analysis for Bengaluru zones." },
      { property: "og:title", content: "Green Cover — UrbanEcoSense Bengaluru" },
      { property: "og:description", content: "Satellite land-cover and NDVI analysis for Bengaluru zones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GreenCoverPage,
});
