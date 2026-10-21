import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthPage } from "@/pages/AuthPage";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — UrbanEcoSense" },
      {
        name: "description",
        content: "Sign in to UrbanEcoSense to monitor Bengaluru air quality, CO₂ and green cover.",
      },
      { property: "og:title", content: "Sign in — UrbanEcoSense" },
      {
        property: "og:description",
        content: "Sign in to UrbanEcoSense to monitor Bengaluru air quality, CO₂ and green cover.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50">
        <div
          className="w-10 h-10 border-eco-200 border-t-eco-600 rounded-full animate-spin"
          style={{ borderWidth: "3px", borderStyle: "solid" }}
        />
      </div>
    );
  }

  return <AuthPage />;
}
