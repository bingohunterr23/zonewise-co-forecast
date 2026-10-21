import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "UrbanEcoSense Dashboard — Bengaluru" },
      { name: "description", content: "Environmental monitoring dashboard for air quality, CO₂, green cover, and tree impact across Bengaluru." },
      { property: "og:title", content: "UrbanEcoSense Dashboard — Bengaluru" },
      { property: "og:description", content: "Environmental monitoring dashboard for air quality, CO₂, green cover, and tree impact across Bengaluru." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardShell,
});

function DashboardShell() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50">
        <div
          className="w-10 h-10 border-eco-200 border-t-eco-600 rounded-full animate-spin"
          style={{ borderWidth: "3px", borderStyle: "solid" }}
        />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
