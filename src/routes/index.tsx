import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UrbanEcoSense — Bengaluru Environmental Intelligence" },
      { name: "description", content: "Sign in to explore live environmental monitoring and green cover across Bengaluru." },
      { property: "og:title", content: "UrbanEcoSense — Bengaluru Environmental Intelligence" },
      { property: "og:description", content: "Sign in to explore live environmental monitoring and green cover across Bengaluru." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
