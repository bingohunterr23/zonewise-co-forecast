import { useLiveReadings } from '@/hooks/useLiveReadings';
import { averageAqi, readingIsStale } from '@/lib/reading-state';
import { Link } from '@tanstack/react-router';
import {
  Wind, Droplets, Thermometer, Cloud, Gauge, Activity, TrendingUp,
  Map, Leaf, TreePine, Footprints, ArrowRight, RefreshCw, AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { zoneApi, liveApi } from '@/services/api';
import type { Zone, LiveReading } from '@/types';
import { useLiveTraffic } from '@/hooks/useLiveTraffic';
import { LiveTrafficBadge } from '@/components/LiveTrafficBadge';
import { Card, PageHeader, ErrorState, Skeleton, formatValue } from '@/components/ui';

export function HomePage() {
  const { zones, readings, loading, error, fetchData, lastUpdated } = useLiveReadings();
  const stale = loading || readings.some(reading => readingIsStale(reading));
  const live = useLiveTraffic();
  const firstReading = readings[0];

  const navCards = [
    { to: '/dashboard/live', label: 'Live Monitoring', desc: 'Real-time air quality & weather', icon: Activity },
    { to: '/dashboard/predict', label: 'CO₂ Prediction', desc: 'Machine-learning-based CO₂ estimates', icon: TrendingUp },
    { to: '/dashboard/map', label: 'Area Visualization', desc: 'Interactive zone map', icon: Map },
    { to: '/dashboard/green-cover', label: 'Green Cover', desc: 'Satellite vegetation analysis', icon: Leaf },
    { to: '/dashboard/tree-impact', label: 'Tree Impact', desc: 'CO₂ absorption calculator', icon: TreePine },
    { to: '/dashboard/carbon-footprint', label: 'Carbon Footprint', desc: 'Personal emissions tracker', icon: Footprints },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Environmental Overview"
        subtitle="Real-time environmental intelligence across Bengaluru monitoring zones"
      />

      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-eco-600">
          <div className={`w-2 h-2 rounded-full ${loading ? 'bg-warm-400 animate-pulse' : error ? 'bg-clay-400' : 'bg-eco-500 animate-pulse-soft'}`} />
          <span>{loading ? 'Fetching live data… · previous readings are stale' : error ? 'Connection issue · retained readings are stale' : stale ? 'Stale readings' : 'Live data active'}</span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-eco-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button disabled={loading} onClick={() => { void fetchData(); void live.refresh(true); }} className="flex items-center gap-1.5 text-sm text-eco-600 hover:text-eco-800 font-medium transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={fetchData} />
        </div>
      )}

      {/* Main metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Overall AQI"
          value={firstReading?.aqi}
          suffix={firstReading?.aqi_category || ''}
          icon={Activity}
          color="eco"
          loading={loading && readings.length === 0}
        />
        <MetricCard
          label="PM2.5"
          value={firstReading?.pm2_5}
          suffix="µg/m³"
          icon={Wind}
          color="clay"
          loading={loading && readings.length === 0}
        />
        <MetricCard
          label="PM10"
          value={firstReading?.pm10}
          suffix="µg/m³"
          icon={Wind}
          color="warm"
          loading={loading && readings.length === 0}
        />
        <MetricCard
          label="CO"
          value={firstReading?.co}
          suffix="µg/m³"
          icon={Gauge}
          color="eco"
          loading={loading && readings.length === 0}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="CO₂ Prediction" value={null} suffix="" icon={TrendingUp} color="eco" loading={false} hint="See CO₂ Prediction" />
        <MetricCard
          label="Temperature"
          value={firstReading?.temperature}
          suffix="°C"
          icon={Thermometer}
          color="warm"
          loading={loading && readings.length === 0}
        />
        <MetricCard
          label="Humidity"
          value={firstReading?.humidity}
          suffix="%"
          icon={Droplets}
          color="eco"
          loading={loading && readings.length === 0}
        />
        <MetricCard
          label="NO₂"
          value={firstReading?.no2}
          suffix="µg/m³"
          icon={Cloud}
          color="clay"
          loading={loading && readings.length === 0}
        />
      </div>

      {/* Region overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <Card className="lg:col-span-1">
          <h3 className="font-semibold text-eco-900 mb-3">Monitoring Regions</h3>
          <div className="space-y-3">
            {['Silk Board Region', 'Lalbagh Region'].map((region) => {
              const regionZones = zones.filter(z => z.region === region);
              const regionReadings = readings.filter(r => r.region === region);
              return (
                <div key={region} className="flex items-center justify-between p-3 rounded-xl bg-warm-50 border border-eco-100/50">
                  <div>
                    <p className="font-medium text-eco-800 text-sm">{region}</p>
                    <p className="text-xs text-eco-400">{regionZones.length} zones</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-eco-700">
                      {averageAqi(regionReadings) ?? '—'}
                    </p>
                    <p className="text-xs text-eco-400">avg AQI</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-eco-900">Zone Quick View</h3>
            <Link to="/dashboard/live" className="text-sm text-eco-600 hover:text-eco-800 font-medium flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {zones.map((zone) => {
              const reading = readings.find(r => r.zone_id === zone.id);
              return (
                <div key={zone.id} className="flex items-center justify-between p-3 rounded-lg border border-eco-100/50 hover:border-eco-200 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-eco-800 truncate">{zone.name}</p>
                    <div className="mt-0.5"><LiveTrafficBadge t={live.forZone(zone.id)} loading={live.loading} /></div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {reading?.aqi ? (
                      <AQIBadge aqi={reading.aqi} />
                    ) : loading ? (
                      <Skeleton className="w-12 h-5" />
                    ) : (
                      <span className="text-xs text-eco-300">N/A</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Quick navigation cards */}
      <div>
        <h3 className="font-semibold text-eco-900 mb-4">Quick Access</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {navCards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="card p-5 group block"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-eco-50 flex items-center justify-center group-hover:bg-eco-100 transition-colors">
                  <card.icon size={20} className="text-eco-600" />
                </div>
                <ArrowRight size={18} className="text-eco-300 group-hover:text-eco-600 group-hover:translate-x-1 transition-all" />
              </div>
              <h4 className="font-semibold text-eco-900 mb-1">{card.label}</h4>
              <p className="text-sm text-eco-500">{card.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, suffix, icon: Icon, color, loading, hint,
}: {
  label: string;
  value: number | null;
  suffix: string;
  icon: LucideIcon;
  color: 'eco' | 'warm' | 'clay';
  loading: boolean;
  hint?: string;
}) {
  const colorClasses = {
    eco: 'bg-eco-50 text-eco-600',
    warm: 'bg-warm-100 text-warm-700',
    clay: 'bg-clay-100 text-clay-500',
  };
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-eco-500 font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={16} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="w-20 h-8" />
      ) : value !== null && value !== undefined ? (
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-eco-900">{value.toFixed(1)}</span>
          {suffix && <span className="text-xs text-eco-400">{suffix}</span>}
        </div>
      ) : hint ? (
        <div className="flex items-center gap-1.5 text-sm text-eco-400">
          <AlertCircle size={14} />
          {hint}
        </div>
      ) : (
        <span className="text-sm text-eco-400">Data unavailable</span>
      )}
    </Card>
  );
}

function AQIBadge({ aqi }: { aqi: number }) {
  const config = aqi <= 1 ? { label: 'Good', cls: 'bg-eco-100 text-eco-700' }
    : aqi <= 3 ? { label: 'Moderate', cls: 'bg-amber-100 text-amber-700' }
    : { label: 'Poor', cls: 'bg-red-100 text-red-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.cls}`}>
      {aqi} · {config.label}
    </span>
  );
}
