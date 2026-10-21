import { createFileRoute } from "@tanstack/react-router";
import { PredictionPage } from "@/pages/PredictionPage";

export const Route = createFileRoute("/dashboard/predict")({
  head: () => ({
    meta: [
      { title: "CO₂ Prediction — UrbanEcoSense Bengaluru" },
      { name: "description", content: "Current Random Forest CO₂ estimates using live environmental inputs across Bengaluru zones." },
      { property: "og:title", content: "CO₂ Prediction — UrbanEcoSense Bengaluru" },
      { property: "og:description", content: "Current Random Forest CO₂ estimates using live environmental inputs across Bengaluru zones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PredictionPage,
});
