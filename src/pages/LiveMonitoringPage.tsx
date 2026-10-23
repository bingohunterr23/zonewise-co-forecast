import { useState } from 'react';
import { useLiveReadings } from '@/hooks/useLiveReadings';
import { readingIsStale } from '@/lib/reading-state';
import {
  Thermometer, Droplets, Gauge, Wind, Cloud, Activity,
  RefreshCw, AlertCircle, MapPin, Clock,
  type LucideIcon,
} from 'lucide-react';
import { zoneApi, liveApi } from '@/services/api';
import type { Zone, LiveReading } from '@/types';
import { useLiveTraffic, type LiveTraffic } from '@/hooks/useLiveTraffic';
import { LiveTrafficBadge, trafficTime } from '@/components/LiveTrafficBadge';
import { Card, PageHeader, ErrorState, Skeleton, formatValue } from '@/components/ui';

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

export function LiveMonitoringPage() {
  const { zones, readings, loading, error, fetchData, lastUpdated } = useLiveReadings();
  const [selectedRegion, setSelectedRegion] = useState<string>('Silk Board Region');
  const live = useLiveTraffic();
  const filteredZones = zones.filter(z => z.region === selectedRegion);
  const getReading = (zoneId: number) => readings.find(r => r.zone_id === zoneId);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Live Monitoring"
        subtitle="Real-time environmental data from OpenWeather — nearest available readings to zone coordinates"
      />

      {/* Region selector + status */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-2">
          {['Silk Board Region', 'Lalbagh Region'].map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                selectedRegion === region
                  ? 'bg-eco-600 text-white shadow-sm'
                  : 'bg-white text-eco-600 border border-eco-200 hover:bg-warm-50'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-eco-400">
              <Clock size={14} />
              {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <button disabled={loading} onClick={() => { void fetchData(); void live.refresh(true); }} className="flex items-center gap-1.5 text-sm text-eco-600 hover:text-eco-800 font-medium transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 p-3 rounded-xl bg-eco-50 border border-eco-100 flex items-start gap-2.5">
        <MapPin size={16} className="text-eco-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-eco-600">
          OpenWeather provides data for the nearest available measurement point to each zone's coordinates.
          These are not physical sensor readings at the exact zone location.
          Auto-refreshes every 5 minutes.
        </p>
      </div>

      {error && !loading && (
        <ErrorState message={error} onRetry={fetchData} />
      )}

      {/* Zone cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredZones.map((zone) => {
          const reading = getReading(zone.id);
          return (
            <ZoneCard key={zone.id} zone={zone} reading={reading} loading={loading} traffic={live.forZone(zone.id)} trafficLoading={live.loading} />
          );
        })}
      </div>
    </div>
  );
}

function ZoneCard({ zone, reading, loading, traffic, trafficLoading }: { zone: Zone; reading?: LiveReading; loading: boolean; traffic?: LiveTraffic; trafficLoading: boolean }) {
  const aqi = reading?.aqi;
  const aqiConfig = aqi === 1
    ? { label: 'Good', color: 'text-eco-700 bg-eco-100', dot: 'bg-eco-500' }
    : aqi && aqi <= 3
    ? { label: 'Moderate', color: 'text-amber-700 bg-amber-100', dot: 'bg-amber-500' }
    : aqi
    ? { label: 'Poor', color: 'text-red-700 bg-red-100', dot: 'bg-red-500' }
    : null;

  return (
    <Card className="overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-eco-900 text-lg">{zone.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <LiveTrafficBadge t={traffic} loading={trafficLoading} />
            <span className="text-xs text-eco-400">
              {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}
            </span>
          </div>
        </div>
        {loading && !reading ? (
          <Skeleton className="w-16 h-7" />
        ) : aqiConfig ? (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${aqiConfig.color}`}>
            <div className={`w-2 h-2 rounded-full ${aqiConfig.dot} animate-pulse-soft`} />
            <span className="text-sm font-semibold">AQI {aqi}</span>
          </div>
        ) : (
          <span className="text-xs text-eco-300">No data</span>
        )}
      </div>

      {/* Live TomTom traffic (measured at nearest road segment) */}
      <div className="mb-3 text-xs text-eco-600">
        <span className="font-medium text-eco-800">Live traffic (TomTom, measured): </span>
        {traffic?.status === 'ok' && traffic.classification
          ? <>{traffic.current_speed} km/h vs free-flow {traffic.free_flow_speed} km/h ({traffic.classification.ratioPct}%) · at {trafficTime(traffic)}</>
          : trafficLoading && !traffic ? 'Loading…' : traffic?.error ?? 'Unavailable'}
        <span className="block text-eco-400">Nearest road segment to the zone point, not the whole zone. Vehicle volume is an ML prediction — see CO₂ Prediction.</span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Metric icon={Thermometer} label="Temp" value={reading?.temperature} unit="°C" />
        <Metric icon={Droplets} label="Humidity" value={reading?.humidity} unit="%" />
        <Metric icon={Gauge} label="Pressure" value={reading?.pressure} unit="hPa" />
        <Metric icon={Wind} label="Wind" value={reading?.wind_speed} unit="m/s" />
        <Metric icon={Cloud} label="Clouds" value={reading?.cloud_coverage} unit="%" />
        <Metric icon={Activity} label="O₃" value={reading?.o3} unit="µg/m³" />
        <Metric icon={Activity} label="PM2.5" value={reading?.pm2_5} unit="µg/m³" />
        <Metric icon={Activity} label="PM10" value={reading?.pm10} unit="µg/m³" />
        <Metric icon={Activity} label="NO₂" value={reading?.no2} unit="µg/m³" />
        <Metric icon={Activity} label="CO" value={reading?.co} unit="µg/m³" />
      </div>

      {reading?.fetched_at && <p className="mt-3 text-xs text-eco-400">{loading || readingIsStale(reading) ? 'Stale · last successful reading: ' : 'Updated: '}{new Date(reading.fetched_at).toLocaleString()}</p>}
      {!loading && reading?.error && <p className="mt-3 text-xs text-clay-500">{reading.error}</p>}
      {!loading && !reading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-clay-500 p-3 rounded-lg bg-clay-50">
          <AlertCircle size={16} />
          Data unavailable for this zone
        </div>
      )}
    </Card>
  );
}

function Metric({
  icon: Icon, label, value, unit,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null | undefined;
  unit: string;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-warm-50 border border-eco-100/40">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} className="text-eco-400" />
        <span className="text-xs text-eco-500">{label}</span>
      </div>
      {value !== null && value !== undefined ? (
        <div className="flex items-baseline gap-0.5">
          <span className="font-semibold text-eco-900 text-sm">{value.toFixed(value < 10 ? 2 : 1)}</span>
          <span className="text-xs text-eco-400">{unit}</span>
        </div>
      ) : (
        <span className="text-xs text-eco-300">Unavailable</span>
      )}
    </div>
  );
}
