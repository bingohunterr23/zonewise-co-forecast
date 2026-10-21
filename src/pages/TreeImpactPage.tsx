import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TreePine, Calculator, Info, Leaf, Car, MapPin, Target, Ruler, ClipboardList, Timer, AlertTriangle } from 'lucide-react';
import { useSearch } from '@tanstack/react-router';
import { treeImpactApi, greenCoverApi, liveApi } from '@/services/api';
import { ZONES_SEED, type TreeImpactResponse, type GreenCoverZone } from '@/types';
import { Card, PageHeader, Badge } from '@/components/ui';
import {
  buildZonePlan,
  formatNumber,
  ZONE_FOOTPRINT_SQM,
  PLANTING_DENSITY_SQM_PER_TREE,
  TARGET_GREEN_COVER_PCT,
} from '@/lib/tree-impact-planning';
import {
  buildCombinedMitigationPlan,
  buildGrowthTimeline,
  MATURITY_YEARS,
  ASSUMED_SURVIVAL_RATE,
  type ZoneConditions,
} from '@/lib/mitigation-planning';

export function TreeImpactPage() {
  const search = useSearch({ strict: false }) as { zone?: number };
  const [numTrees, setNumTrees] = useState(10);
  const [area, setArea] = useState(100);
  const [result, setResult] = useState<TreeImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zones, setZones] = useState<GreenCoverZone[]>([]);
  const [zoneId, setZoneId] = useState<number | null>(search.zone ?? null);
  const [zoneError, setZoneError] = useState('');
  const [conditions, setConditions] = useState<ZoneConditions>({});

  useEffect(() => {
    greenCoverApi
      .get()
      .then((r) => {
        setZones(r.zones);
        setZoneId((prev) => prev ?? r.zones[0]?.zone_id ?? null);
      })
      .catch((e) => setZoneError((e as Error).message));
  }, []);

  const selectedZone = zones.find((z) => z.zone_id === zoneId) ?? null;
  const plan =
    selectedZone && selectedZone.green_cover_percentage !== null
      ? buildZonePlan(selectedZone.green_cover_percentage)
      : null;

  // Best-effort live conditions for the selected zone: they only sharpen the
  // priorities of the action plan, so a failure here is not surfaced as an error.
  useEffect(() => {
    if (zoneId === null) return;
    let cancelled = false;
    const liveZone = ZONES_SEED.find((zone) => zone.id === zoneId);
    if (!liveZone) return;
    setConditions({});
    liveApi
      .getZoneReading(liveZone)
      .then((r) => {
        if (cancelled) return;
        setConditions({ aqi: r.aqi, pm2_5: r.pm2_5, pm10: r.pm10, no2: r.no2, co: r.co });
      })
      .catch(() => setConditions({}));
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const mitigation = useMemo(() => {
    if (!selectedZone || selectedZone.green_cover_percentage === null) return null;
    return buildCombinedMitigationPlan(
      selectedZone.zone_id,
      selectedZone.green_cover_percentage,
      conditions,
    );
  }, [selectedZone, conditions]);

  const capacity = mitigation?.capacity ?? null;
  const priorityColor = (p: string) => (p === 'High' ? 'red' : p === 'Medium' ? 'amber' : 'eco') as
    | 'red'
    | 'amber'
    | 'eco';

  const handleCalculate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await treeImpactApi.calculate({
        number_of_trees: numTrees,
        plantation_area_sqm: area,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const chartData = result ? [
    { name: 'Annual CO₂ Absorbed', value: result.annual_co2_absorption_kg, color: '#2e9161' },
    { name: 'Equivalent Car Emissions', value: result.equivalent_car_km_per_year * 0.192, color: '#b36b56' },
  ] : [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Tree Impact Calculator"
        subtitle="Estimate annual CO₂ absorption from tree plantation projects"
      />

      <div className="mb-6 p-4 rounded-xl bg-eco-50 border border-eco-100 flex items-start gap-3">
        <Info size={18} className="text-eco-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-eco-700">
          Calculations use a scientifically documented absorption factor of
          <strong> 21.77 kg CO₂ per tree per year</strong> (EPA estimate for a mature tree).
          This factor is configurable in the backend via the <code className="px-1 py-0.5 rounded bg-warm-100 text-warm-700 text-xs">TREE_CO2_ABSORPTION_KG_PER_YEAR</code> environment variable.
        </p>
      </div>

      {/* Zone-based plan from Green Cover data */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={20} className="text-eco-600" />
          <h3 className="font-semibold text-eco-900">Zone Plantation Plan (from Green Cover)</h3>
        </div>

        {zoneError && <p className="text-sm text-clay-500 mb-3">{zoneError}</p>}

        <div className="flex flex-wrap gap-2 mb-4">
          {zones.map((z) => (
            <button
              key={z.zone_id}
              onClick={() => setZoneId(z.zone_id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                z.zone_id === zoneId
                  ? 'bg-eco-600 text-white border-eco-600 shadow-sm'
                  : 'bg-white text-eco-600 border-eco-200 hover:bg-warm-50'
              }`}
            >
              {z.zone_name}
            </button>
          ))}
        </div>

        {plan && selectedZone ? (
          <div className="animate-slide-up">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-eco-50 border border-eco-100">
                <p className="text-xs text-eco-500 mb-1">Current Green Cover</p>
                <p className="text-xl font-bold text-eco-800">{plan.current_green_cover_pct}%</p>
                <p className="text-xs text-eco-400 mt-0.5">NDVI {selectedZone.ndvi?.toFixed(3) ?? 'N/A'}</p>
              </div>
              <div className="p-3 rounded-xl bg-eco-50 border border-eco-100">
                <p className="text-xs text-eco-500 mb-1 flex items-center gap-1"><Target size={12} /> Target</p>
                <p className="text-xl font-bold text-eco-800">{plan.target_green_cover_pct}%</p>
                <p className="text-xs text-eco-400 mt-0.5">National Forest Policy</p>
              </div>
              <div className="p-3 rounded-xl bg-warm-50 border border-warm-200">
                <p className="text-xs text-warm-600 mb-1">Green Cover Gap</p>
                <p className="text-xl font-bold text-warm-700">{plan.green_cover_gap_pct}%</p>
                <p className="text-xs text-warm-500 mt-0.5">to reach target</p>
              </div>
              <div className="p-3 rounded-xl bg-eco-50 border border-eco-100">
                <p className="text-xs text-eco-500 mb-1">Plantation Area Needed</p>
                <p className="text-xl font-bold text-eco-800">{formatNumber(plan.plantation_area_sqm)} m²</p>
                <p className="text-xs text-eco-400 mt-0.5">{(plan.plantation_area_sqm / 1e6).toFixed(2)} km²</p>
              </div>
              <div className="p-3 rounded-xl bg-eco-50 border border-eco-100">
                <p className="text-xs text-eco-500 mb-1">Trees Required</p>
                <p className="text-xl font-bold text-eco-800">{formatNumber(plan.trees_required)}</p>
                <p className="text-xs text-eco-400 mt-0.5">1 tree / {PLANTING_DENSITY_SQM_PER_TREE} m²</p>
              </div>
              <div className="p-3 rounded-xl bg-eco-50 border border-eco-100">
                  <p className="text-xs text-eco-500 mb-1 flex items-center gap-1"><Leaf size={12} /> CO₂ at Mature Rate</p>
                <p className="text-xl font-bold text-eco-800">{formatNumber(plan.annual_co2_absorption_tons)} t</p>
                <p className="text-xs text-eco-400 mt-0.5">{formatNumber(plan.equivalent_car_km_per_year)} car-km offset</p>
              </div>
            </div>

            {plan.green_cover_gap_pct === 0 && (
              <p className="mt-3 text-sm text-eco-700">
                This zone already exceeds the {plan.target_green_cover_pct}% target — no additional plantation is required to meet it.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setNumTrees(Math.max(1, Math.min(plan.trees_required, capacity?.feasible_trees ?? plan.trees_required)));
                  setArea(capacity?.capacity_area_sqm ?? plan.plantation_area_sqm);
                }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-eco-50 text-eco-700 border border-eco-200 hover:bg-eco-100 transition-colors"
              >
                Load estimated feasible capacity
              </button>
              <p className="text-xs text-eco-400">
                Zone footprint: {(ZONE_FOOTPRINT_SQM / 1e6).toFixed(2)} km² (1 km radius, ESA WorldCover sample area) ·
                target {TARGET_GREEN_COVER_PCT}% · source: {selectedZone.source}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-eco-400">Loading zone green-cover data...</p>
        )}
      </Card>

      {/* Capacity-aware authority action plan */}
      {mitigation && capacity && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList size={20} className="text-eco-600" />
              <div>
                <h3 className="font-semibold text-eco-900">Planting Capacity & Authority Action Plan</h3>
                <p className="text-xs text-eco-500 mt-0.5">{selectedZone?.zone_name} · system-generated recommendations</p>
              </div>
            </div>
            <Badge color="amber">Potential sites · authority verification required</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div className="p-3 rounded-xl bg-eco-50 border border-eco-100">
              <p className="text-xs text-eco-500 mb-1">Trees required for long-term mitigation</p>
              <p className="text-xl font-bold text-eco-800">{formatNumber(capacity.trees_required)}</p>
              <p className="text-xs text-eco-400 mt-0.5">Green-cover target calculation</p>
            </div>
            <div className="p-3 rounded-xl bg-eco-50 border border-eco-100">
              <p className="text-xs text-eco-500 mb-1">Estimated feasible planting capacity</p>
              <p className="text-xl font-bold text-eco-800">{formatNumber(capacity.feasible_trees)}</p>
              <p className="text-xs text-eco-400 mt-0.5">~{formatNumber(capacity.capacity_area_sqm)} m² potential area · {capacity.coverage_pct}% of requirement</p>
            </div>
            <div className="p-3 rounded-xl bg-warm-50 border border-warm-200">
              <p className="text-xs text-warm-600 mb-1">Not assumed plantable</p>
              <p className="text-xl font-bold text-warm-700">{formatNumber(capacity.shortfall_trees)}</p>
              <p className="text-xs text-warm-500 mt-0.5">Remaining gap addressed with combined measures</p>
            </div>
          </div>

          <div className="mb-5">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-eco-800 mb-2"><Ruler size={15} /> Potential planting locations</h4>
            <p className="text-xs text-eco-500 mb-3">Estimated from zone land-cover fractions and planning assumptions; no parcel has been verified as available.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[620px]">
                <thead className="text-eco-500 border-b border-eco-100">
                  <tr><th className="py-2 pr-3 font-medium">Potential site type</th><th className="py-2 pr-3 font-medium">Estimated area</th><th className="py-2 pr-3 font-medium">Potential trees</th><th className="py-2 font-medium">Verify with</th></tr>
                </thead>
                <tbody>
                  {capacity.sites.map((site) => (
                    <tr key={site.category} className="border-b border-eco-100/60 last:border-0">
                      <td className="py-2 pr-3 font-medium text-eco-800">{site.category}</td>
                      <td className="py-2 pr-3 text-eco-600">~{formatNumber(site.area_sqm)} m²</td>
                      <td className="py-2 pr-3 text-eco-600">~{formatNumber(site.trees)}</td>
                      <td className="py-2 text-eco-500">{site.verifying_authority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-5 p-3 rounded-xl bg-warm-50 border border-warm-200">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-warm-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-warm-700">Planning estimate, not a land inventory</p>
                <p className="text-xs text-warm-600 mt-1">Parks/open spaces, verges, suitable medians, institutional land and green corridors are potential categories only. Confirm ownership, access, utilities, sight-lines, soil, water, and tree suitability before assigning a site.</p>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-eco-800"><ClipboardList size={15} /> Combined authority actions</h4>
              <span className="text-xs text-eco-500">Priorities use available zone data; air-quality data may be unavailable.</span>
            </div>
            <div className="space-y-3">
              {mitigation.actions.map((action) => (
                <div key={action.id} className="border border-eco-100 rounded-xl p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-eco-800">{action.title}</h5>
                        <Badge color={priorityColor(action.priority)}>{action.priority} priority</Badge>
                        <Badge color={action.immediate ? 'clay' : 'eco'}>{action.timeframe}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-eco-500">{action.category} · {action.authority}</p>
                    </div>
                    <span className="text-xs text-eco-500">{action.immediate ? 'Immediate reduction pathway' : 'Long-term green benefit'}</span>
                  </div>
                  <p className="mt-2 text-xs text-eco-700"><strong>Problem:</strong> {action.problem}</p>
                  <p className="mt-1 text-xs text-eco-700"><strong>Recommended action:</strong> {action.action}</p>
                  <p className="mt-1 text-xs text-eco-600"><strong>Expected benefit:</strong> {action.expected_benefit}</p>
                  <p className="mt-1 text-xs text-eco-500"><strong>Basis:</strong> {action.basis}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-eco-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Timer size={16} className="text-eco-600" />
              <h4 className="text-sm font-semibold text-eco-800">Tree impact grows over time</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {mitigation.growth_timeline.map((point) => (
                <div key={point.year} className="p-2 rounded-lg bg-eco-50 border border-eco-100">
                  <p className="text-xs font-semibold text-eco-700">Year {point.year}</p>
                  <p className="text-xs text-eco-500 mt-0.5">{point.phase}</p>
                  <p className="text-sm font-bold text-eco-800 mt-1">{formatNumber(point.effective_co2_kg_per_year)} kg/year</p>
                  <p className="text-[11px] text-eco-400">{point.maturity_pct}% mature rate</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-eco-500 mt-2">Illustrative growth curve: ~{MATURITY_YEARS} years to mature absorption; {Math.round(ASSUMED_SURVIVAL_RATE * 100)}% survival assumed. Species, care, site conditions and survival materially affect real outcomes.</p>
          </div>

          <div className="mt-4 text-xs text-eco-500 space-y-1">
            {mitigation.notes.map((note) => <p key={note}>• {note}</p>)}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input form */}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Calculator size={20} className="text-eco-600" />
            <h3 className="font-semibold text-eco-900">Plantation Details</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-eco-700 mb-1.5">
                Number of Trees
              </label>
              <input
                type="number"
                min="1"
                value={numTrees}
                onChange={(e) => setNumTrees(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field"
              />
              <input
                type="range"
                min="1"
                max="1000"
                value={numTrees}
                onChange={(e) => setNumTrees(parseInt(e.target.value))}
                className="w-full mt-2 accent-eco-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-eco-700 mb-1.5">
                Plantation Area (m²)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={area}
                onChange={(e) => setArea(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="input-field"
              />
            </div>

            <button
              onClick={handleCalculate}
              disabled={loading}
              className="btn-primary w-full disabled:opacity-60"
            >
              {loading ? 'Calculating...' : 'Calculate Impact'}
            </button>

            {error && (
              <div className="p-3 rounded-lg bg-clay-50 text-clay-500 text-sm">
                {error}
              </div>
            )}
          </div>
        </Card>

        {/* Results */}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <TreePine size={20} className="text-eco-600" />
            <h3 className="font-semibold text-eco-900">Environmental Impact</h3>
          </div>

          {result ? (
            <div className="animate-slide-up">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-eco-50 border border-eco-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Leaf size={14} className="text-eco-600" />
                    <span className="text-xs text-eco-500">Mature-rate absorption</span>
                  </div>
                  <p className="text-xl font-bold text-eco-800">{result.annual_co2_absorption_kg} kg</p>
                  <p className="text-xs text-eco-400 mt-0.5">{result.annual_co2_absorption_tons} tons CO₂/year at maturity</p>
                </div>
                <div className="p-3 rounded-xl bg-warm-50 border border-warm-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Car size={14} className="text-warm-600" />
                    <span className="text-xs text-warm-600">Car Equivalent</span>
                  </div>
                  <p className="text-xl font-bold text-warm-700">{result.equivalent_car_km_per_year} km</p>
                  <p className="text-xs text-warm-500 mt-0.5">offset per year</p>
                </div>
              </div>

              <div className="mb-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dcf0e3" />
                    <XAxis dataKey="name" stroke="#54ae80" fontSize={10} tick={{ fill: '#1f754d' }} />
                    <YAxis stroke="#54ae80" fontSize={11} tick={{ fill: '#1f754d' }} />
                    <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #bbe1c9', fontSize: '12px' }} formatter={(v) => `${Number(v).toFixed(2)} kg`} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3 rounded-xl bg-warm-50 border border-eco-100/50">
                <p className="text-sm text-eco-700">{result.recommendation}</p>
              </div>

              <div className="mt-3 text-xs text-eco-400">
                Absorption factor: {result.absorption_factor_kg_per_tree_per_year} kg/tree/year
              </div>
              <div className="mt-4 pt-3 border-t border-eco-100">
                <p className="text-sm font-semibold text-eco-800 mb-2">Estimated uptake as trees mature</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {buildGrowthTimeline(numTrees).map((point) => (
                    <div key={point.year} className="p-2 rounded-lg bg-eco-50 border border-eco-100">
                      <p className="text-xs font-semibold text-eco-700">Year {point.year}</p>
                      <p className="text-sm font-bold text-eco-800 mt-1">{formatNumber(point.effective_co2_kg_per_year)} kg/year</p>
                      <p className="text-[11px] text-eco-400">{point.maturity_pct}% mature rate</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-eco-500 mt-2">Illustrative only: ~{MATURITY_YEARS}-year maturity period and 70% survival assumed; actual uptake depends on species, site and care. Figures are potential, not immediate reductions.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-eco-300">
              <TreePine size={48} className="mb-3" />
              <p className="text-sm">Enter plantation details and calculate to see results</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
