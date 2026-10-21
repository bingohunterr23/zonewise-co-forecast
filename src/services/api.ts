/**
 * Frontend API layer.
 *
 * All backend work now runs inside this app's TanStack server functions
 * (src/lib/ues.functions.ts) — there is no separate FastAPI process to start.
 * The OpenWeather key stays server-side; the browser never sees it.
 */
import { ZONES_SEED } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import {
  getZonesFn,
  getLiveReadingsFn,
  getLiveReadingFn,
  getModelStatusFn,
  getModelMetricsFn,
  getModelFeaturesFn,
  getDatasetsFn,
  predictCo2Fn,
  predictZoneFn,
  predictZonesFn,
  getGreenCoverFn,
  getHealthFn,
} from "@/lib/ues.functions";
import type {
  User,
  Zone,
  LiveReading,
  TreeImpactRequest,
  TreeImpactResponse,
  CarbonFootprintRequest,
  CarbonFootprintResponse,
  ModelMetrics,
  ModelFeatures,
  PredictCO2Response,
  GreenCoverResponse,
  ModelStatus,
  DatasetsResponse,
  ZoneLivePrediction,
  HealthResponse,
} from "@/types";

/** Kept for backwards compatibility with existing UI retry buttons. */
export function resetBackendCheck() {
  /* no external backend to re-probe anymore */
}

function authErrorMessage(message: string, action: "signup" | "login" | "logout"): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "This email is already registered. Please sign in instead.";
  }
  if (normalized.includes("invalid login credentials") || normalized.includes("invalid credentials")) {
    return "Incorrect email or password.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  return message || `Unable to ${action}. Please try again.`;
}

function toAppUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
    is_active: true,
  };
}

// ─── Auth (persistent Lovable Cloud accounts) ───
export const authApi = {
  async signup(email: string, password: string, fullName?: string): Promise<User> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    if (error) throw new Error(authErrorMessage(error.message, "signup"));
    if (data.user?.identities?.length === 0) {
      throw new Error("This email is already registered. Please sign in instead.");
    }
    if (!data.user) throw new Error("Your account could not be created. Please try again.");
    if (!data.session) {
      throw new Error("Your account was created, but email confirmation is still required before you can sign in.");
    }
    return toAppUser(data.user);
  },

  async login(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(authErrorMessage(error.message, "login"));
    if (!data.user) throw new Error("Incorrect email or password.");
    return toAppUser(data.user);
  },

  async logout() {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error(authErrorMessage(error.message, "logout"));
  },
};

// ─── Zones ───
export const zoneApi = {
  async getZones(): Promise<Zone[]> {
    try {
      return (await getZonesFn()) as Zone[];
    } catch {
      return ZONES_SEED;
    }
  },
};

// ─── Live monitoring (OpenWeather via server function) ───
export const liveApi = {
  async getZoneReading(zone: Zone): Promise<LiveReading> {
    return (await getLiveReadingFn({ data: { zoneId: zone.id } })) as LiveReading;
  },

  async getAllReadings(_zones?: Zone[]): Promise<LiveReading[]> {
    return (await getLiveReadingsFn()) as LiveReading[];
  },
};

// ─── ML model ───
export const modelApi = {
  async getStatus(): Promise<ModelStatus> {
    return (await getModelStatusFn()) as ModelStatus;
  },
  async getMetrics(): Promise<ModelMetrics> {
    return (await getModelMetricsFn()) as ModelMetrics;
  },
  async getFeatures(): Promise<ModelFeatures> {
    return (await getModelFeaturesFn()) as ModelFeatures;
  },
  async getDatasets(): Promise<DatasetsResponse> {
    return (await getDatasetsFn()) as unknown as DatasetsResponse;
  },
  async predict(features: Record<string, number>): Promise<PredictCO2Response> {
    return (await predictCo2Fn({ data: { features } })) as PredictCO2Response;
  },
  async predictZone(zoneId: number): Promise<ZoneLivePrediction> {
    return (await predictZoneFn({ data: { zoneId } })) as ZoneLivePrediction;
  },
  async predictAllZones(): Promise<ZoneLivePrediction[]> {
    return (await predictZonesFn()) as ZoneLivePrediction[];
  },
  async retrain(): Promise<{ status: string; message: string }> {
    return {
      status: "static",
      message:
        "The Random Forest is trained offline with ml/train_model.py and shipped as src/lib/ml/model.json.",
    };
  },
};

// ─── Health ───
export const healthApi = {
  async check(): Promise<HealthResponse> {
    return (await getHealthFn()) as HealthResponse;
  },
};

// ─── Green cover (ESA WorldCover / Sentinel-2 dataset) ───
export const greenCoverApi = {
  async get(): Promise<GreenCoverResponse> {
    return (await getGreenCoverFn()) as GreenCoverResponse;
  },
};

// ─── Tree impact ───
const TREE_CO2_ABSORPTION_KG_PER_YEAR = 21.77;
const CAR_EMISSION_KG_PER_KM = 0.192;

export const treeImpactApi = {
  async calculate(req: TreeImpactRequest): Promise<TreeImpactResponse> {
    const annual = req.number_of_trees * TREE_CO2_ABSORPTION_KG_PER_YEAR;
    const tons = annual / 1000;
    const carKm = annual / CAR_EMISSION_KG_PER_KM;
    const density = req.plantation_area_sqm > 0 ? req.number_of_trees / req.plantation_area_sqm : 0;
    let recommendation: string;
    if (density > 0.01) {
      recommendation = `Density is high (${density.toFixed(4)} trees/sqm). Ensure adequate spacing for healthy growth.`;
    } else if (tons > 1.0) {
      recommendation = `This plantation offsets ${tons.toFixed(2)} tons of CO2 per year — equivalent to driving a car for ${carKm.toFixed(0)} km. Excellent environmental impact.`;
    } else {
      recommendation = `This plantation absorbs ${annual.toFixed(1)} kg of CO2 per year. Consider planting more trees for greater impact.`;
    }
    return {
      number_of_trees: req.number_of_trees,
      plantation_area_sqm: req.plantation_area_sqm,
      annual_co2_absorption_kg: Math.round(annual * 100) / 100,
      absorption_factor_kg_per_tree_per_year: TREE_CO2_ABSORPTION_KG_PER_YEAR,
      annual_co2_absorption_tons: Math.round(tons * 10000) / 10000,
      equivalent_car_km_per_year: Math.round(carKm * 10) / 10,
      recommendation,
    };
  },
};

// ─── Carbon footprint (India-specific emission factors) ───
const VEHICLE_EF_PER_KM: Record<string, number> = {
  petrol_car: 0.192,
  diesel_car: 0.171,
  cng_car: 0.145,
  electric_car: 0.053,
  bus: 0.105,
  motorcycle: 0.103,
  two_wheeler: 0.092,
  none: 0.0,
};
const FUEL_EF_PER_LITER: Record<string, number> = {
  petrol: 2.31,
  diesel: 2.68,
  cng: 1.89,
  none: 0.0,
};
const FREQUENCY_MULT: Record<string, number> = { daily: 365, weekly: 52, monthly: 12 };
const EF_ELECTRICITY_PER_KWH = 0.82;

export const carbonFootprintApi = {
  async calculate(req: CarbonFootprintRequest): Promise<CarbonFootprintResponse> {
    const ef = VEHICLE_EF_PER_KM[req.vehicle_type] ?? 0;
    const freqMult = FREQUENCY_MULT[req.travel_frequency.toLowerCase()] ?? 365;
    const transportEmissions = req.daily_distance_km * freqMult * ef;

    const ft = (req.fuel_type || "none").toLowerCase();
    const fuelEmissions = req.fuel_consumption_per_month * 12 * (FUEL_EF_PER_LITER[ft] ?? 0);
    const elecEmissions = req.electricity_usage_kwh_per_month * 12 * EF_ELECTRICITY_PER_KWH;

    const total = transportEmissions + fuelEmissions + elecEmissions;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);

    const recs: string[] = [];
    if (transportEmissions > 1000) {
      if (req.vehicle_type !== "electric_car")
        recs.push(
          "Consider switching to an electric vehicle or using public transport more frequently.",
        );
      recs.push("Carpooling or combining trips can significantly reduce transportation emissions.");
    }
    if (fuelEmissions > 500)
      recs.push(
        "Optimize fuel consumption by maintaining proper tire pressure and avoiding idling.",
      );
    if (elecEmissions > 1000)
      recs.push(
        "Switch to LED lighting and energy-efficient appliances, or consider rooftop solar.",
      );
    if (recs.length === 0)
      recs.push("Your footprint is already below the Indian urban average — keep it up!");

    return {
      transportation_emissions_kg: Math.round(transportEmissions * 100) / 100,
      fuel_emissions_kg: Math.round(fuelEmissions * 100) / 100,
      electricity_emissions_kg: Math.round(elecEmissions * 100) / 100,
      total_co2e_kg: Math.round(total * 100) / 100,
      total_co2e_tons: Math.round((total / 1000) * 10000) / 10000,
      category_breakdown: [
        {
          category: "Transportation",
          co2e_kg: Math.round(transportEmissions * 100) / 100,
          percentage: pct(transportEmissions),
        },
        {
          category: "Fuel",
          co2e_kg: Math.round(fuelEmissions * 100) / 100,
          percentage: pct(fuelEmissions),
        },
        {
          category: "Electricity",
          co2e_kg: Math.round(elecEmissions * 100) / 100,
          percentage: pct(elecEmissions),
        },
      ],
      recommendations: recs,
    };
  },
};
