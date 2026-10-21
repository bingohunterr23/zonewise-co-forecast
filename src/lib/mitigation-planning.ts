/**
 * Planting-capacity + combined mitigation planning for the eight Bengaluru zones.
 *
 * WHY THIS EXISTS
 * ---------------
 * `tree-impact-planning.ts` answers "how many trees would be needed to reach the
 * 33% green-cover target?". In a dense city that number is usually far larger
 * than the land that could realistically be planted. This module adds:
 *
 *   1. An ESTIMATED PLANTING CAPACITY per zone, derived from the ESA WorldCover
 *      land-cover fractions already used by the Green Cover page.
 *   2. A COMBINED MITIGATION PLAN that covers the shortfall with non-tree,
 *      feasible measures instead of demanding more trees.
 *   3. A TREE MATURITY CURVE so long-term absorption is not credited on day one.
 *
 * IMPORTANT DATA HONESTY NOTES (surfaced in the UI):
 *  - No land parcel here is confirmed as available. Every capacity figure is a
 *    POTENTIAL planting location estimated from land-cover shares and standard
 *    urban-planning rules of thumb. Each one REQUIRES AUTHORITY VERIFICATION
 *    (BBMP / Forest Cell / traffic and road-owning agencies) before use.
 *  - No authority has reviewed, approved or committed to any action listed
 *    here. These are system-generated recommendations only.
 *  - CO2 reduction figures are ESTIMATED POTENTIAL, not achieved reductions.
 */
import { ZONE_LAND_COVER } from "./green-cover-data";
import { ZONES_SEED } from "@/types";
import {
  ZONE_FOOTPRINT_SQM,
  TREE_CO2_KG_PER_YEAR,
  buildZonePlan,
} from "./tree-impact-planning";

/* ────────────────────────────── planting capacity ───────────────────────── */

export interface PlantingSiteEstimate {
  /** Public-space category where plantation may be possible. */
  category: string;
  /** How the area was derived, in plain words. */
  basis: string;
  /** Estimated potential planting area, m². */
  area_sqm: number;
  /** Spacing assumption used for this category (m² per tree). */
  density_sqm_per_tree: number;
  /** Trees that could fit, at that spacing. */
  trees: number;
  /** Agency that would have to confirm the land is actually usable. */
  verifying_authority: string;
}

export interface ZonePlantingCapacity {
  zone_id: number;
  zone_name: string;
  sites: PlantingSiteEstimate[];
  capacity_area_sqm: number;
  /** Estimated feasible tree count across all potential sites. */
  feasible_trees: number;
  /** Trees needed to close the 33% green-cover gap. */
  trees_required: number;
  /** Trees that cannot be planted for lack of realistic space. */
  shortfall_trees: number;
  /** Share of the requirement that plantation alone could cover (%). */
  coverage_pct: number;
  /** Mature-tree CO2 the feasible plantation could absorb, kg/year. */
  feasible_mature_co2_kg_per_year: number;
  /** Mature-tree CO2 the shortfall represents, kg/year — must come from other measures. */
  residual_co2_kg_per_year: number;
}

/**
 * Share of a zone's footprint that each public-space category plausibly
 * occupies, and how much of that share could carry trees.
 *
 * These are PLANNING ASSUMPTIONS, not survey data. They are deliberately
 * conservative and are shown to the user alongside every number they drive.
 */
const SITE_RULES = [
  {
    category: "Parks & public open spaces",
    // Grassland/open vegetation inside the buffer; only part of it is public
    // land that can take additional trees without losing its open character.
    share: (lc: LandCover) => (lc.grassland_pct / 100) * 0.35,
    density: 25,
    basis: "35% of mapped open/grassland cover assumed to be public park land available for infill planting",
    authority: "BBMP Horticulture Department",
  },
  {
    category: "Road verges & footpath edges",
    // Verges are a thin slice of built-up land; heavier corridors have wider
    // carriageways and therefore slightly more verge, but less free width.
    share: (lc: LandCover, heavy: boolean) => (lc.built_up_pct / 100) * (heavy ? 0.014 : 0.011),
    density: 9,
    basis: "≈1.1–1.4% of built-up land assumed to be plantable verge, at avenue spacing",
    authority: "BBMP Road Infrastructure / Ward Engineer",
  },
  {
    category: "Suitable road medians",
    share: (lc: LandCover, heavy: boolean) => (lc.built_up_pct / 100) * (heavy ? 0.005 : 0.003),
    density: 12,
    basis: "Narrow strip of arterial medians assumed wide enough for shrubs/small trees",
    authority: "BBMP + Bengaluru Traffic Police (sight-line clearance)",
  },
  {
    category: "Government & institutional land",
    share: (lc: LandCover) => (lc.built_up_pct / 100) * 0.009,
    density: 25,
    basis: "Assumed share of built-up land in school, hospital, depot and office campuses with plantable setbacks",
    authority: "Respective land-owning department",
  },
  {
    category: "Lake buffers & green corridors",
    share: (lc: LandCover) => (lc.water_pct / 100) * 0.25 + (lc.cropland_pct / 100) * 0.2,
    density: 20,
    basis: "Buffer strips around mapped water bodies plus residual cropland along drains/rail corridors",
    authority: "BBMP Lakes Division / Karnataka Forest Department",
  },
] as const;

type LandCover = (typeof ZONE_LAND_COVER)[number];

export function buildPlantingCapacity(
  zoneId: number,
  currentGreenCoverPct: number,
): ZonePlantingCapacity | null {
  const lc = ZONE_LAND_COVER.find((l) => l.zone_id === zoneId);
  const zone = ZONES_SEED.find((z) => z.id === zoneId);
  if (!lc || !zone) return null;

  const heavy = zone.traffic_category === "Heavy Traffic";

  const sites: PlantingSiteEstimate[] = SITE_RULES.map((rule) => {
    const area = Math.round(rule.share(lc, heavy) * ZONE_FOOTPRINT_SQM);
    return {
      category: rule.category,
      basis: rule.basis,
      area_sqm: area,
      density_sqm_per_tree: rule.density,
      trees: Math.round(area / rule.density),
      verifying_authority: rule.authority,
    };
  }).filter((s) => s.trees > 0);

  const capacityArea = sites.reduce((sum, s) => sum + s.area_sqm, 0);
  const feasible = sites.reduce((sum, s) => sum + s.trees, 0);

  const plan = buildZonePlan(currentGreenCoverPct);
  const required = plan.trees_required;
  const usable = Math.min(feasible, required);
  const shortfall = Math.max(0, required - feasible);

  return {
    zone_id: zoneId,
    zone_name: zone.name,
    sites,
    capacity_area_sqm: capacityArea,
    feasible_trees: feasible,
    trees_required: required,
    shortfall_trees: shortfall,
    coverage_pct: required > 0 ? Math.round((usable / required) * 1000) / 10 : 100,
    feasible_mature_co2_kg_per_year: Math.round(usable * TREE_CO2_KG_PER_YEAR),
    residual_co2_kg_per_year: Math.round(shortfall * TREE_CO2_KG_PER_YEAR),
  };
}

/* ─────────────────────────── tree growth / maturity ─────────────────────── */

/**
 * Newly planted saplings absorb very little CO2. This simple ramp assumes a
 * sapling reaches the mature 21.77 kg/tree/year rate after ~20 years, with
 * negligible uptake in the establishment years.
 *
 * ASSUMPTION, not a measured species curve — species, soil, water and survival
 * rate all change the real trajectory.
 */
export const MATURITY_YEARS = 20;
/** Assumed share of saplings surviving to maturity under urban conditions. */
export const ASSUMED_SURVIVAL_RATE = 0.7;

export function maturityFactor(year: number): number {
  if (year <= 0) return 0;
  if (year >= MATURITY_YEARS) return 1;
  // Slow start, steepest growth mid-period, plateau near maturity.
  return Math.round(Math.pow(year / MATURITY_YEARS, 1.6) * 1000) / 1000;
}

export interface GrowthPoint {
  year: number;
  phase: string;
  maturity_pct: number;
  effective_co2_kg_per_year: number;
  effective_co2_tons_per_year: number;
}

export function buildGrowthTimeline(trees: number): GrowthPoint[] {
  const surviving = trees * ASSUMED_SURVIVAL_RATE;
  const phases: Array<[number, string]> = [
    [1, "Plantation & establishment"],
    [3, "Early growth"],
    [5, "Active growth"],
    [10, "Approaching canopy"],
    [20, "Mature canopy"],
  ];
  return phases.map(([year, phase]) => {
    const f = maturityFactor(year);
    const kg = surviving * TREE_CO2_KG_PER_YEAR * f;
    return {
      year,
      phase,
      maturity_pct: Math.round(f * 100),
      effective_co2_kg_per_year: Math.round(kg),
      effective_co2_tons_per_year: Math.round((kg / 1000) * 100) / 100,
    };
  });
}

/* ───────────────────────── combined mitigation plan ─────────────────────── */

export type Priority = "High" | "Medium" | "Low";
export type Timeframe = "Immediate" | "Short-term" | "Medium-term" | "Long-term";

export interface MitigationAction {
  id: string;
  title: string;
  category: string;
  problem: string;
  action: string;
  priority: Priority;
  authority: string;
  timeframe: Timeframe;
  expected_benefit: string;
  /** Evidence/assumption context for the expected benefit. */
  basis: string;
  /** True for measures that act within months, false for green/long-term ones. */
  immediate: boolean;
}

export interface ZoneConditions {
  aqi?: number | null;
  pm2_5?: number | null;
  pm10?: number | null;
  no2?: number | null;
  co?: number | null;
}

export interface CombinedMitigationPlan {
  capacity: ZonePlantingCapacity;
  actions: MitigationAction[];
  /** Residual after feasible plantation, kg CO2/year. */
  residual_co2_kg_per_year: number;
  growth_timeline: GrowthPoint[];
  notes: string[];
}

interface ActionRule {
  id: string;
  title: string;
  category: string;
  authority: string;
  timeframe: Timeframe;
  immediate: boolean;
  basePriority: Priority;
  expected_benefit: string;
  basis: string;
  problem: (c: ZoneConditions, heavy: boolean) => string;
  action: string;
  /** Raise priority when the zone's own data points at this problem. */
  escalate?: (c: ZoneConditions, heavy: boolean) => boolean;
}

const ACTION_RULES: ActionRule[] = [
  {
    id: "traffic-flow",
    title: "Junction signal & traffic-flow optimisation",
    category: "Traffic management",
    authority: "Bengaluru Traffic Police (with BBMP)",
    timeframe: "Immediate",
    immediate: true,
    basePriority: "Medium",
    expected_benefit: "Less idling at signals — lower CO, NO₂ and CO₂ at the junction",
    basis: "The local traffic category is used to prioritise this action; no vehicle-count or idling-duration data is available to quantify emissions.",
    problem: (c, heavy) =>
      heavy
        ? "Heavy-traffic corridor with stop-start queueing; idling vehicles raise CO and CO₂ locally."
        : "Peak-hour queueing adds avoidable idling emissions.",
    action:
      "Re-time signal cycles on the corridor, add turning-lane management and enforce no-idling at long-cycle junctions.",
    escalate: (c, heavy) => heavy || (c.co ?? 0) > 800,
  },
  {
    id: "public-transport",
    title: "Public transport frequency & bus priority",
    category: "Public transport",
    authority: "BMTC (with BBMP, Bengaluru Traffic Police)",
    timeframe: "Short-term",
    immediate: true,
    basePriority: "High",
    expected_benefit: "Each shifted car trip removes roughly 0.19 kg CO₂ per km travelled",
    basis: "The local traffic category is used to prioritise this action; passenger counts and mode-shift data are not available to quantify emissions.",
    problem: (c, heavy) =>
      heavy
        ? "High private-vehicle dependence on a saturated corridor."
        : "Limited high-frequency service pushes short trips onto private vehicles.",
    action:
      "Increase peak-hour bus frequency, add bus-priority lanes and first/last-mile feeders at the zone's main stops.",
    escalate: (c, heavy) => heavy,
  },
  {
    id: "vehicle-emissions",
    title: "Vehicle emission checks & older-vehicle phase-out",
    category: "Vehicle emission reduction",
    authority: "Karnataka Transport Department (RTO)",
    timeframe: "Short-term",
    immediate: true,
    basePriority: "Medium",
    expected_benefit: "Fewer high-emitting vehicles — direct NO₂ and particulate reduction",
    basis: "NO₂ is used as an indicator where available; fleet age and compliance records are not available to quantify emissions.",
    problem: (c) =>
      (c.no2 ?? 0) > 40
        ? "Elevated NO₂ indicates a combustion-heavy vehicle mix in the zone."
        : "Ageing and poorly maintained vehicles add avoidable tailpipe emissions.",
    action:
      "Run roadside emission-check drives in the zone and prioritise it for commercial-fleet retirement incentives.",
    escalate: (c) => (c.no2 ?? 0) > 40,
  },
  {
    id: "ev-transition",
    title: "EV & low-emission fleet transition",
    category: "EV / low-emission measures",
    authority: "BESCOM, BMTC & BBMP",
    timeframe: "Medium-term",
    immediate: false,
    basePriority: "Medium",
    expected_benefit: "Replaces tailpipe emissions in the zone with grid emissions elsewhere",
    basis: "Local fleet and EV-adoption data are not available to quantify reductions.",
    problem: () => "Local buses, autos and delivery fleets are largely fossil-fuelled.",
    action:
      "Add public charging at parking hubs and prioritise the zone for electric bus and last-mile delivery fleets.",
  },
  {
    id: "dust-control",
    title: "Road dust control & shoulder paving",
    category: "Road dust control",
    authority: "BBMP Solid Waste & Road Infrastructure",
    timeframe: "Immediate",
    immediate: true,
    basePriority: "Medium",
    expected_benefit: "Directly lowers PM10 and PM2.5, the fastest-acting air-quality gain",
    basis: "PM10 is used as an indicator where available; dust-control benefits are particulate reductions and are not converted to CO₂.",
    problem: (c) =>
      (c.pm10 ?? 0) > 100
        ? "PM10 is high — resuspended road and construction dust is a likely contributor."
        : "Unpaved shoulders and construction spillover generate resuspended dust.",
    action:
      "Schedule mechanised sweeping and water sprinkling on arterial stretches, pave shoulders and sheet construction sites.",
    escalate: (c) => (c.pm10 ?? 0) > 100 || (c.pm2_5 ?? 0) > 60,
  },
  {
    id: "carpool",
    title: "Carpooling & vehicle-use reduction",
    category: "Travel demand",
    authority: "BBMP with local employers / RWAs",
    timeframe: "Short-term",
    immediate: true,
    basePriority: "Low",
    expected_benefit: "Fewer vehicle trips at peak hours",
    basis: "Commuter and trip-distance data are not available to quantify vehicle-use reductions.",
    problem: () => "Single-occupancy commuting concentrates trips into peak hours.",
    action:
      "Run employer carpool and staggered-timing programmes with the zone's largest offices and tech parks.",
  },
  {
    id: "green-corridor",
    title: "Green corridors along verges & drains",
    category: "Green corridors",
    authority: "BBMP Forest Cell & Karnataka Forest Department",
    timeframe: "Medium-term",
    immediate: false,
    basePriority: "Medium",
    expected_benefit: "Continuous canopy, dust interception and lower surface temperature",
    basis: "Potential corridor linkages require site mapping and authority verification; no parcel or corridor is confirmed.",
    problem: () =>
      "Existing green patches are fragmented, limiting canopy benefit per tree planted.",
    action:
      "Link parks, lake buffers and verges into continuous planted corridors along drains and arterial roads.",
  },
];

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

export function buildCombinedMitigationPlan(
  zoneId: number,
  currentGreenCoverPct: number,
  conditions: ZoneConditions = {},
): CombinedMitigationPlan | null {
  const capacity = buildPlantingCapacity(zoneId, currentGreenCoverPct);
  if (!capacity) return null;

  const zone = ZONES_SEED.find((z) => z.id === zoneId);
  if (!zone) return null;
  const heavy = zone.traffic_category === "Heavy Traffic";
  const residual = capacity.residual_co2_kg_per_year;

  const recommendedTrees = Math.min(capacity.feasible_trees, capacity.trees_required);
  const plantationAction: MitigationAction = {
    id: "feasible-plantation",
    title: "Feasible tree plantation on verified public sites",
    category: "Tree plantation",
    problem: `Green cover is below the 33% target and only about ${capacity.coverage_pct}% of the required trees can realistically be planted in this zone.`,
    action: `Plant up to ${recommendedTrees.toLocaleString("en-IN")} trees across the potential sites listed above, after BBMP verifies each location.`,
    priority: recommendedTrees > 0 ? "High" : "Low",
    authority: "BBMP Forest Cell & Karnataka Forest Department",
    timeframe: "Long-term",
    expected_benefit: `Up to ${Math.round(capacity.feasible_mature_co2_kg_per_year / 1000).toLocaleString("en-IN")} t CO₂/year once the canopy matures (~${MATURITY_YEARS} years), plus shade and dust interception`,
    basis: `Potential at maturity only: feasible tree count × 21.77 kg/tree/year; ${Math.round(ASSUMED_SURVIVAL_RATE * 100)}% assumed survival. Not an achieved reduction.`,
    immediate: false,
  };

  const actions: MitigationAction[] = ACTION_RULES.map((rule) => {
    const escalated = rule.escalate?.(conditions, heavy) ?? false;
    const priority: Priority = escalated
      ? rule.basePriority === "Low"
        ? "Medium"
        : "High"
      : rule.basePriority;
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      problem: rule.problem(conditions, heavy),
      action: rule.action,
      priority,
      authority: rule.authority,
      timeframe: rule.timeframe,
      expected_benefit: rule.expected_benefit,
      basis: rule.basis,
      immediate: rule.immediate,
    };
  }).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  const notes = [
    "Planting locations are POTENTIAL sites estimated from land-cover data. None is confirmed available — each requires authority verification and a site survey.",
    "No authority has reviewed, approved or committed to any action here. These are system-generated recommendations.",
    "Immediate measures are not assigned CO₂ reduction figures: vehicle counts, trip distances, fleet data and measured implementation outcomes are unavailable.",
    `Tree benefits are credited over a ~${MATURITY_YEARS}-year growth curve with an assumed ${Math.round(ASSUMED_SURVIVAL_RATE * 100)}% survival rate, not from the day of planting.`,
  ];

  return {
    capacity,
    actions: [plantationAction, ...actions],
    residual_co2_kg_per_year: residual,
    growth_timeline: buildGrowthTimeline(
      Math.min(capacity.feasible_trees, capacity.trees_required),
    ),
    notes,
  };
}
