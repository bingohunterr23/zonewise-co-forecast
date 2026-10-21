import { createFileRoute } from "@tanstack/react-router";
import { CarbonFootprintPage } from "@/pages/CarbonFootprintPage";

export const Route = createFileRoute("/dashboard/carbon-footprint")({
  head: () => ({
    meta: [
      { title: "Carbon Footprint — UrbanEcoSense Bengaluru" },
      { name: "description", content: "Calculate your annual personal CO₂e footprint." },
      { property: "og:title", content: "Carbon Footprint — UrbanEcoSense Bengaluru" },
      { property: "og:description", content: "Calculate your annual personal CO₂e footprint." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarbonFootprintPage,
});
