import { useState, useEffect, useCallback } from 'react';
import { Leaf, Settings, AlertCircle, MapPin, Satellite, TreePine } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { greenCoverApi } from '@/services/api';
import type { GreenCoverResponse } from '@/types';
import { Card, PageHeader, LoadingState, ErrorState } from '@/components/ui';
import { buildPlantingCapacity } from '@/lib/mitigation-planning';
import { buildZonePlan, formatNumber } from '@/lib/tree-impact-planning';

export function GreenCoverPage() {
  const [data, setData] = useState<GreenCoverResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await greenCoverApi.get();
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div><PageHeader title="Green Cover" /><LoadingState message="Loading green cover data..." /></div>;
  if (error) return <div><PageHeader title="Green Cover" /><ErrorState message={error} onRetry={fetchData} /></div>;

  const configured = data?.configured;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Green Cover"
        subtitle="Satellite-based vegetation analysis across monitoring zones"
      />

      {/* Setup state */}
      {!configured && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Settings size={24} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 mb-2">Satellite Provider Not Configured</h3>
              <p className="text-sm text-amber-700 mb-4">{data?.setup_message}</p>

              <div className="bg-white rounded-xl p-4 border border-amber-200">
                <h4 className="text-sm font-semibold text-eco-800 mb-3 flex items-center gap-2">
                  <Satellite size={16} className="text-eco-600" />
                  Setup Instructions
                </h4>
                <ol className="space-y-2 text-sm text-eco-600">
                  <li className="flex gap-2">
                    <span className="font-bold text-eco-700">1.</span>
                    <span>Sign up for a satellite imagery provider (Sentinel Hub offers free tiers for NDVI data)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-eco-700">2.</span>
                    <span>In <code className="px-1.5 py-0.5 rounded bg-warm-100 text-warm-700 text-xs">backend/.env</code>, set <code className="px-1.5 py-0.5 rounded bg-warm-100 text-warm-700 text-xs">SATELLITE_PROVIDER=sentinelhub</code></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-eco-700">3.</span>
                    <span>Set <code className="px-1.5 py-0.5 rounded bg-warm-100 text-warm-700 text-xs">SATELLITE_API_KEY=your_key_here</code></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-eco-700">4.</span>
                    <span>Restart the backend server</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </Card>
      )}

      {configured && (
        <div className="mb-6 p-4 rounded-xl bg-eco-50 border border-eco-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-eco-100 flex items-center justify-center">
            <Leaf size={20} className="text-eco-600" />
          </div>
          <div>
            <p className="font-medium text-eco-800">Provider: {data?.provider}</p>
            <p className="text-sm text-eco-500">Satellite data is active</p>
          </div>
        </div>
      )}

      {/* Zone cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data?.zones.map((zone) => (
          <Card key={zone.zone_id}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-medium text-eco-900 text-sm">{zone.zone_name}</h3>
                <p className="text-xs text-eco-400 mt-0.5 flex items-center gap-1">
                  <MapPin size={11} /> {zone.region}
                </p>
              </div>
              <Leaf size={18} className={configured ? 'text-eco-500' : 'text-eco-200'} />
            </div>

            {configured ? (
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-eco-500 mb-1">Green Cover</p>
                  <p className="text-2xl font-bold text-eco-700">
                    {zone.green_cover_percentage !== null
                      ? `${zone.green_cover_percentage.toFixed(1)}%`
                      : 'Unavailable'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-eco-500">NDVI</p>
                  <p className="text-sm font-medium text-eco-600">
                    {zone.ndvi !== null ? zone.ndvi.toFixed(3) : 'Unavailable'}
                  </p>
                </div>
                {zone.green_cover_percentage !== null && (() => {
                  const requirement = buildZonePlan(zone.green_cover_percentage).trees_required;
                  const capacity = buildPlantingCapacity(zone.zone_id, zone.green_cover_percentage);
                  if (!capacity) return null;
                  return (
                    <div className="pt-2 mt-2 border-t border-eco-100/50">
                      <p className="text-xs text-eco-500">Planting requirement vs potential capacity</p>
                      <div className="flex items-baseline justify-between gap-2 mt-1">
                        <span className="text-sm font-semibold text-eco-800">{formatNumber(requirement)} required</span>
                        <span className="text-sm font-semibold text-eco-600">~{formatNumber(capacity.feasible_trees)} potential</span>
                      </div>
                      <p className="text-xs text-eco-400 mt-1">Estimated public sites only; authority verification required</p>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-eco-300">No data</p>
                <p className="text-xs text-eco-300 mt-1">Configure satellite provider</p>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-eco-100/50">
              <p className="text-xs text-eco-400">Source: {zone.source}</p>
              <button
                onClick={() =>
                  navigate({ to: '/dashboard/tree-impact', search: { zone: zone.zone_id } })
                }
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-eco-50 text-eco-700 border border-eco-200 hover:bg-eco-100 transition-colors"
              >
                <TreePine size={13} /> Plan trees for this zone
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
