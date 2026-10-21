import { createFileRoute } from "@tanstack/react-router";
import { TreeImpactPage } from "@/pages/TreeImpactPage";

export const Route = createFileRoute("/dashboard/tree-impact")({
  validateSearch: (search: Record<string, unknown>) => ({
    zone: search["zone"] != null ? Number(search["zone"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tree Impact — UrbanEcoSense Bengaluru" },
      { name: "description", content: "Estimate CO₂ absorbed by tree plantation projects." },
      { property: "og:title", content: "Tree Impact — UrbanEcoSense Bengaluru" },
      { property: "og:description", content: "Estimate CO₂ absorbed by tree plantation projects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TreeImpactPage,
});
