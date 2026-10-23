import { useState, useEffect } from 'react';
import { useLiveReadings } from '@/hooks/useLiveReadings';
import { readingIsStale } from '@/lib/reading-state';
import { Button } from '@/components/ui/button';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Filter, AlertCircle, Cloud, Wind, Layers, RefreshCw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { zoneApi, liveApi, modelApi } from '@/services/api';
import type { Zone, LiveReading } from '@/types';
import { useLiveTraffic, type LiveTraffic } from '@/hooks/useLiveTraffic';
import { LiveTrafficBadge, trafficTime } from '@/components/LiveTrafficBadge';
import { Card, PageHeader, ErrorState, Skeleton } from '@/components/ui';

// Fix default marker icon
const greenIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#2e9161;border:2px solid #fff;box-shadow:0 2px 8px rgba(20,61,45,0.3);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">
    <div style="width:8px;height:8px;background:#fff;border-radius:50%;transform:rotate(45deg);"></div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

function pinIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(20,61,45,0.3);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">
    <div style="width:8px;height:8px;background:#fff;border-radius:50%;transform:rotate(45deg);"></div>
  </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}
const moderateIcon = pinIcon('#d29a3a');
const unavailableIcon = pinIcon('#9aa5a0');
function iconFor(t?: LiveTraffic) {
  if (!t || t.status !== 'ok' || !t.classification) return unavailableIcon;
  const l = t.classification.level;
  return l === 'heavy' ? heavyIcon : l === 'moderate' ? moderateIcon : greenIcon;
}

const heavyIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#b36b56;border:2px solid #fff;box-shadow:0 2px 8px rgba(179,107,86,0.3);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">
    <div style="width:8px;height:8px;background:#fff;border-radius:50%;transform:rotate(45deg);"></div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

function MapBounds({ zones }: { zones: Zone[] }) {
  const map = useMap();
  useEffect(() => {
    if (zones.length > 0) {
      const bounds = L.latLngBounds(zones.map(z => [z.latitude, z.longitude]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [zones, map]);
  return null;
}

export function AreaVisualizationPage() {
  const { zones, readings, loading, error, fetchData, lastUpdated } = useLiveReadings();
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const live = useLiveTraffic();
  const [basemap, setBasemap] = useState<'street' | 'satellite'>('street');

  const filteredZones = selectedRegion === 'all'
    ? zones
    : zones.filter(z => z.region === selectedRegion);

  const getReading = (zoneId: number) => readings.find(r => r.zone_id === zoneId);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Area Visualization"
        subtitle="Interactive map of all 8 Bengaluru monitoring zones with live environmental data"
      />

      <div className="flex items-center gap-3 mb-3 text-xs text-eco-500">
        {lastUpdated && <span>{loading || readings.some(reading => readingIsStale(reading)) ? 'Stale · ' : ''}Last updated: {lastUpdated.toLocaleString()}</span>}
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => { void fetchData(); void live.refresh(true); }}><RefreshCw size={14} />Refresh</Button>
      </div>
      {/* Region filter */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 text-eco-600">
          <Filter size={16} />
          <span className="text-sm font-medium">Filter:</span>
        </div>
        <div className="flex gap-2">
          {['all', 'Silk Board Region', 'Lalbagh Region'].map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedRegion === region
                  ? 'bg-eco-600 text-white shadow-sm'
                  : 'bg-white text-eco-600 border border-eco-200 hover:bg-warm-50'
              }`}
            >
              {region === 'all' ? 'All Regions' : region}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Layers size={16} className="text-eco-600" />
          <div className="flex rounded-lg overflow-hidden border border-eco-200">
            {(['street', 'satellite'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBasemap(b)}
                className={`px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                  basemap === b ? 'bg-eco-600 text-white' : 'bg-white text-eco-600 hover:bg-warm-50'
                }`}
              >
                {b === 'street' ? 'Street Map' : 'Satellite'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-hidden">
            {loading && readings.length === 0 ? (
              <Skeleton className="w-full h-[500px] rounded-2xl" />
            ) : (
              <MapContainer
                center={[12.93, 77.61]}
                zoom={12}
                style={{ height: '500px', width: '100%' }}
                scrollWheelZoom
              >
                {basemap === 'satellite' ? (
                  <TileLayer
                    key="satellite"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                    maxZoom={19}
                  />
                ) : (
                  <TileLayer
                    key="street"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                )}
                <MapBounds zones={filteredZones} />
                {filteredZones.map((zone) => {
                  const reading = getReading(zone.id);
                  const t = live.forZone(zone.id);
                  const icon = iconFor(t);
                  return (
                    <Marker
                      key={zone.id}
                      position={[zone.latitude, zone.longitude]}
                      icon={icon}
                      eventHandlers={{ click: () => setSelectedZoneId(zone.id) }}
                    >
                      <Popup>
                        <div style={{ minWidth: '200px', fontFamily: 'Inter, sans-serif' }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#174a34', marginBottom: '4px' }}>
                            {zone.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#54ae80', marginBottom: '8px' }}>
                            {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#333', marginBottom: '8px' }}>
                            <strong>Live traffic (TomTom):</strong>{' '}
                            {t?.status === 'ok' && t.classification
                              ? `${t.classification.label} · ${t.current_speed}/${t.free_flow_speed} km/h (${t.classification.ratioPct}%) · ${trafficTime(t)}`
                              : live.loading && !t ? 'Loading…' : t?.error ?? 'Unavailable'}
                            <div style={{ fontSize: '10px', color: '#54ae80' }}>Nearest road segment, not the whole zone</div>
                          </div>
                          <div style={{ fontSize: '12px', color: '#333', lineHeight: '1.8' }}>
                            <div><strong>AQI:</strong> {reading?.aqi ?? 'Unavailable'} {reading?.aqi_category ? `(${reading.aqi_category})` : ''}</div>
                            <div><strong>PM2.5:</strong> {reading?.pm2_5?.toFixed(1) ?? 'Unavailable'} µg/m³</div>
                            <div><strong>PM10:</strong> {reading?.pm10?.toFixed(1) ?? 'Unavailable'} µg/m³</div>
                            <div><strong>CO₂:</strong> <em>See CO₂ Prediction</em></div>
                            <div><strong>Source:</strong> {reading?.source ?? 'N/A'}</div>
                            {reading && <div>{loading || readingIsStale(reading) ? 'Stale · ' : ''}{reading.fetched_at ? new Date(reading.fetched_at).toLocaleString() : 'No successful reading'}</div>}
                            {reading?.error && <div>{reading.error}</div>}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            )}
          </Card>
        </div>

        {/* Zone list sidebar */}
        <div className="space-y-3">
          <Card>
            <h3 className="font-semibold text-eco-900 mb-3 flex items-center gap-2">
              <MapPin size={18} className="text-eco-600" />
              Zones ({filteredZones.length})
            </h3>
            <div className="space-y-2 max-h-[440px] overflow-y-auto">
              {filteredZones.map((zone) => {
                const reading = getReading(zone.id);
                const isSelected = selectedZoneId === zone.id;
                return (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedZoneId(zone.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? 'border-eco-400 bg-eco-50'
                        : 'border-eco-100/50 hover:border-eco-200 hover:bg-warm-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-eco-800 truncate">{zone.name}</p>
                        <p className="text-xs text-eco-400 mt-0.5">{zone.region}</p>
                      </div>
                      <span className="flex-shrink-0 max-w-[55%] text-right">
                        <LiveTrafficBadge t={live.forZone(zone.id)} loading={live.loading} />
                      </span>
                    </div>
                    {reading?.error && <p className="mt-2 text-xs text-clay-500">{reading.error}</p>}
                    {reading && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-eco-500">
                        <span className="flex items-center gap-1">
                          <Cloud size={12} /> {reading.aqi ?? 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Wind size={12} /> {reading.pm2_5?.toFixed(1) ?? 'N/A'}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {error && (
            <Card>
              <div className="flex items-start gap-2 text-clay-500 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full" style={{ background: '#2e9161' }} />
              <span className="text-sm text-eco-700">Free-flowing / light congestion (live)</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full" style={{ background: '#d29a3a' }} />
              <span className="text-sm text-eco-700">Moderate congestion (live)</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full" style={{ background: '#b36b56' }} />
              <span className="text-sm text-eco-700">Heavy congestion (live)</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full" style={{ background: '#9aa5a0' }} />
              <span className="text-sm text-eco-700">Traffic unavailable</span>
            </div>
            <p className="text-xs text-eco-400">TomTom speed at the road segment nearest each zone point, compared with that road's free-flow speed. Refreshes every 5 minutes.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
