import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/pages/HomePage";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Dashboard — UrbanEcoSense Bengaluru" },
      {
        name: "description",
        content: "Overview of live air quality and CO₂ intelligence across 8 Bengaluru zones.",
      },
      { property: "og:title", content: "Dashboard — UrbanEcoSense Bengaluru" },
      {
        property: "og:description",
        content: "Overview of live air quality and CO₂ intelligence across 8 Bengaluru zones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});
