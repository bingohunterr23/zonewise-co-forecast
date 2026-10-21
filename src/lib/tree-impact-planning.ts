/**
 * Zone-level plantation planning derived from the ESA WorldCover green-cover
 * dataset (see green-cover-data.ts).
 *
 * Assumptions (documented in the UI):
 *  - Zone footprint = 1 km radius buffer around the zone centroid (the same
 *    footprint the WorldCover fractions were sampled over) = π km².
 *  - Target green cover = 33%, the national green-cover target set by India's
 *    National Forest Policy (1988) for territorial areas.
 *  - Planting density = 1 tree per 25 m² (5 m × 5 m spacing), the spacing used
 *    in BBMP avenue/block plantation guidelines.
 *  - CO₂ absorption = 21.77 kg per tree per year (EPA mature-tree estimate),
 *    the same factor the manual calculator uses.
 */
export const ZONE_FOOTPRINT_SQM = Math.PI * 1_000 * 1_000; // 1 km radius
export const TARGET_GREEN_COVER_PCT = 33;
export const PLANTING_DENSITY_SQM_PER_TREE = 25;
export const TREE_CO2_KG_PER_YEAR = 21.77;
export const CAR_EMISSION_KG_PER_KM = 0.192;

export interface ZonePlantationPlan {
  current_green_cover_pct: number;
  target_green_cover_pct: number;
  green_cover_gap_pct: number;
  plantation_area_sqm: number;
  trees_required: number;
  annual_co2_absorption_kg: number;
  annual_co2_absorption_tons: number;
  equivalent_car_km_per_year: number;
}

export function buildZonePlan(currentPct: number): ZonePlantationPlan {
  const gap = Math.max(0, TARGET_GREEN_COVER_PCT - currentPct);
  const area = (gap / 100) * ZONE_FOOTPRINT_SQM;
  const trees = Math.round(area / PLANTING_DENSITY_SQM_PER_TREE);
  const kg = trees * TREE_CO2_KG_PER_YEAR;
  return {
    current_green_cover_pct: Math.round(currentPct * 10) / 10,
    target_green_cover_pct: TARGET_GREEN_COVER_PCT,
    green_cover_gap_pct: Math.round(gap * 10) / 10,
    plantation_area_sqm: Math.round(area),
    trees_required: trees,
    annual_co2_absorption_kg: Math.round(kg * 100) / 100,
    annual_co2_absorption_tons: Math.round((kg / 1000) * 100) / 100,
    equivalent_car_km_per_year: Math.round(kg / CAR_EMISSION_KG_PER_KM),
  };
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}
