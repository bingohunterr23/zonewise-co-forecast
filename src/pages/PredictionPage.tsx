import { useState, useEffect, useCallback, useRef } from 'react';
import { trafficCondition } from '@/lib/co2/traffic-condition';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, AlertCircle, Info, Cpu, Database, Activity, Clock, MapPin,
  Cloud, Loader2, Car, ArrowRight, RefreshCw, type LucideIcon,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { ZONES_SEED } from '@/types';
import { getCo2ModelInfoFn, predictLocationCo2Fn } from '@/lib/co2.functions';
import { Card, PageHeader, ErrorState, LoadingState, Skeleton } from '@/components/ui';

const LIVE_REFRESH_MS = 10 * 60 * 1000;

type ModelInfo = Awaited<ReturnType<typeof getCo2ModelInfoFn>>;
type LocationPrediction = Awaited<ReturnType<typeof predictLocationCo2Fn>>;

const UNAVAILABLE = 'Unavailable';
const fmt = (v: number | null | undefined, d = 1) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : UNAVAILABLE;

export function PredictionPage() {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [zoneId, setZoneId] = useState<number>(ZONES_SEED[0]!.id);
  const [result, setResult] = useState<LocationPrediction | null>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState('');

  const loadInfo = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInfo(await getCo2ModelInfoFn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reqId = useRef(0);
  const predict = useCallback(async (id: number) => {
    const my = ++reqId.current; // ignore stale responses after a zone switch
    setPredLoading(true);
    setPredError('');
    setResult(prev => (prev?.location.id === id ? prev : null));
    try {
      const r = await predictLocationCo2Fn({ data: { zoneId: id } });
      if (my === reqId.current) setResult(r);
    } catch (e) {
      if (my !== reqId.current) return;
      setResult(null);
      setPredError((e as Error).message);
    } finally {
      if (my === reqId.current) setPredLoading(false);
    }
  }, []);

  useEffect(() => { void loadInfo(); }, [loadInfo]);
  useEffect(() => {
    void predict(zoneId);
    const t = setInterval(() => { void predict(zoneId); }, LIVE_REFRESH_MS);
    return () => clearInterval(t);
  }, [zoneId, predict]);

  if (loading) return (
    <div>
      <PageHeader title="CO₂ Intelligence" subtitle="Estimated CO₂ emissions from live Bengaluru traffic" />
      <LoadingState message="Loading models..." />
    </div>
  );

  const p = result?.prediction ?? null;
  const hourNow = result?.time.hour;
  const profileData = info
    ? info.traffic.hourly_profile.weekday.map((v, h) => ({
        hour: `${h}`,
        weekday: v,
        weekend: info.traffic.hourly_profile.weekend[h],
      }))
    : [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="CO₂ Intelligence"
        subtitle="Random Forest estimate of CO₂ emissions from live Bengaluru traffic and weather"
      />

      <div className="mb-6 p-4 rounded-xl bg-eco-50 border border-eco-100 flex items-start gap-3">
        <Info size={18} className="text-eco-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-eco-700 space-y-1">
          <p>
            <strong>Estimated CO₂ Emissions</strong> — ML-based zone estimate; not a direct atmospheric CO₂ measurement.
            Estimated CO₂ (kg/h) = predicted vehicles/hour (Random Forest trained on the Bengaluru traffic dataset, fed with live
            TomTom speed, OpenWeather condition and the current hour/day) × zone link length (from the dataset's route
            coordinates) × Σ (vehicle-type share × ARAI CO₂ emission factor) ÷ 1000.
          </p>
          <p>
            Sources: emission factors from ARAI (2007) <em>Emission Factor Development for Indian Vehicles</em>, Table I;
            vehicle mix from RITES (2007) <em>Comprehensive Traffic &amp; Transportation Plan for Bangalore</em>, Fig. 3.3 (M G Road).
            This is a simplified emission-factor method in the EMEP/EEA structure, not full COPERT: no speed correction,
            one city-wide vehicle mix for all zones, and a 2007-era fleet. PM2.5, PM10, NO₂, CO, O₃ and SO₂ are not CO₂ and are
            never converted into CO₂. Missing live inputs show <strong>Unavailable</strong>.
          </p>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={loadInfo} /> : (
        <>
          {info && (!info.configured.traffic || !info.configured.openweather) && (
            <div className="mb-6 p-4 rounded-xl bg-clay-50 border border-clay-100 flex items-start gap-3">
              <AlertCircle size={18} className="text-clay-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-clay-600">
                Waiting for live data connections:
                {!info.configured.traffic && ' traffic service'}
                {!info.configured.traffic && !info.configured.openweather && ' and'}
                {!info.configured.openweather && ' OpenWeather'}. Estimates show Unavailable until connected.
              </p>
            </div>
          )}

          <Section title="Live Prediction" icon={MapPin}>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <select
                value={zoneId}
                onChange={(e) => setZoneId(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-eco-200 bg-card text-sm text-eco-900"
              >
                {ZONES_SEED.map(z => <option key={z.id} value={z.id}>{z.name} · {z.region}</option>)}
              </select>
              <button
                onClick={() => void predict(zoneId)}
                disabled={predLoading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-eco-600 text-primary-foreground text-sm font-medium disabled:opacity-60"
              >
                {predLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
              </button>
            </div>

            {predError && <div className="mb-4 p-3 rounded-xl bg-clay-50 border border-clay-100 text-sm text-clay-600">Live prediction failed: {predError}</div>}

            {predLoading && !result ? <Skeleton className="w-full h-48 rounded-2xl" /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-stretch">
                <FlowCard step="1" icon={MapPin} title="Location">
                  <div className="text-base font-semibold text-eco-900">{result?.location.name ?? UNAVAILABLE}</div>
                  <p className="text-xs text-eco-400">{result?.location.region}</p>
                  {result && <p className="text-xs text-eco-400">{result.location.latitude.toFixed(4)}, {result.location.longitude.toFixed(4)}</p>}
                </FlowCard>
                <FlowCard step="2" icon={Car} title="Current traffic">
                  {result?.traffic ? (
                    <>
                      <Row label="Live speed (measured)" value={`${fmt(result.traffic.current_speed, 0)} km/h`} />
                      <Row label="Road's free-flow speed" value={`${fmt(result.traffic.free_flow_speed, 0)} km/h`} />
                      <Row label="Speed vs free-flow" value={result.traffic.free_flow_speed > 0 ? `${Math.round((result.traffic.current_speed / result.traffic.free_flow_speed) * 100)}%` : UNAVAILABLE} />
                      <Row label="Condition" value={trafficCondition(result.traffic.current_speed, result.traffic.free_flow_speed) ?? UNAVAILABLE} />
                      <Row label="Vehicles (ML prediction)" value={p ? `≈${p.expected_vehicles_per_hour.toLocaleString()} /h` : UNAVAILABLE} />
                      <p className="text-xs text-eco-400 mt-1">{result.traffic.provider}</p>
                    </>
                  ) : <Unavailable />}
                </FlowCard>
                <FlowCard step="3" icon={Cloud} title="Weather">
                  {result?.weather ? (
                    <>
                      <div className="text-base font-semibold text-eco-900 capitalize">{result.weather.description ?? result.weather.condition}</div>
                      <Row label="Temp" value={`${fmt(result.weather.temperature)} °C`} />
                      <Row label="Humidity" value={`${fmt(result.weather.humidity, 0)} %`} />
                      <Row label="Wind" value={`${fmt(result.weather.wind_speed)} m/s`} />
                      <p className="text-xs text-eco-400 mt-1">{result.weather.provider}</p>
                    </>
                  ) : <Unavailable />}
                  <div className="pt-2 mt-2 border-t border-eco-100 space-y-1">
                    <p className="text-xs font-medium text-eco-600">Air quality (context, not CO₂)</p>
                    <Row label="AQI" value={fmt(result?.air?.aqi, 0)} />
                    <Row label="PM2.5" value={`${fmt(result?.air?.pm2_5)} µg/m³`} />
                    <Row label="PM10" value={`${fmt(result?.air?.pm10)} µg/m³`} />
                    <Row label="NO₂" value={`${fmt(result?.air?.no2)} µg/m³`} />
                    <Row label="CO" value={`${fmt(result?.air?.co)} µg/m³`} />
                    <Row label="O₃" value={`${fmt(result?.air?.o3)} µg/m³`} />
                    <Row label="SO₂" value={`${fmt(result?.air?.so2)} µg/m³`} />
                    <Row label="NH₃" value={`${fmt(result?.air?.nh3)} µg/m³`} />
                  </div>
                </FlowCard>
                <FlowCard step="4" icon={TrendingUp} title="Estimated CO₂ Emissions" highlight>
                  {p ? (
                    <>
                      <div className="text-2xl font-bold text-eco-900">{p.estimated_co2_kg_per_hour.toLocaleString()}</div>
                      <p className="text-xs text-eco-500">kg CO₂ / hour · calculated, ML-assisted zone estimate</p>
                      <Row label="Vehicles / h (ML prediction)" value={p.expected_vehicles_per_hour.toLocaleString()} />
                      <Row label="Link length (dataset coordinates)" value={`${p.zone_distance_km} km`} />
                      <Row label="Vehicle-km / h" value={p.vehicle_km_per_hour.toLocaleString()} />
                      <Row label="Fleet-average factor (ARAI)" value={`${p.fleet_ef_g_per_vkm} g CO₂/veh-km`} />
                      <div className="pt-2 mt-2 border-t border-eco-200 space-y-1">
                        {p.breakdown.map(b => (
                          <Row key={b.category} label={`${b.category} (${b.share_pct}% · ${b.ef_g_per_km} g/km)`} value={`${b.kg_per_hour} kg/h`} />
                        ))}
                      </div>
                    </>
                  ) : <Unavailable />}
                </FlowCard>
                <FlowCard step="5" icon={Clock} title="Timestamp">
                  {result ? (
                    <>
                      <div className="text-base font-semibold text-eco-900">{result.time.dayName}</div>
                      <Row label="Date" value={result.time.date} />
                      <Row label="Hour (IST)" value={`${String(result.time.hour).padStart(2, '0')}:00`} />
                      <Row label="Peak hour" value={p ? (p.time.is_peak ? 'Yes' : 'No') : UNAVAILABLE} />
                      <p className="text-xs text-eco-400 mt-1">{new Date(result.timestamp).toLocaleString()}</p>
                    </>
                  ) : <Unavailable />}
                </FlowCard>
              </div>
            )}
            {result && result.errors.length > 0 && (
              <p className="mt-3 text-xs text-clay-500">Missing inputs: {result.errors.join(' · ')}</p>
            )}
            {result && (
              <Link
                to="/dashboard/tree-impact"
                search={{ zone: result.location.id }}
                className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-eco-700"
              >
                Plan trees for {result.location.name} <ArrowRight size={14} />
              </Link>
            )}
          </Section>

          {info && (
            <>
              <Section title="Models" icon={Cpu}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ModelCard
                    title="Bengaluru traffic-pattern model"
                    dataset={info.traffic.dataset}
                    target="Vehicles per hour (route flow)"
                    metrics={info.traffic.metrics}
                    importance={info.traffic.feature_importance}
                    note="Test set = last 20% of dataset rows (the file has no calendar dates, so a true time-based split is not possible). 'vehicles' is read as hourly flow: one record per route per hour, always below road_capacity. Dataset 'distance' is in map degrees, so link length is recomputed from route coordinates."
                  />
                  <ModelCard
                    title="India CO₂ emission model"
                    dataset={info.co2.dataset}
                    target={info.co2.target}
                    metrics={info.co2.metrics}
                    importance={info.co2.feature_importance}
                    note={`State-level historical context only (latest year ${info.co2.karnataka_latest.Year}); not used in, or presented as, the zone estimate.`}
                  />
                </div>
              </Section>

              <Section title="Learned Bengaluru traffic pattern" icon={Activity}>
                <Card>
                  <p className="text-xs text-eco-400 mb-3">
                    Average vehicles by hour · peak hours: {info.traffic.peak_hours.join(', ')}
                    {hourNow != null && ` · now: ${hourNow}:00`}
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={profileData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="weekday" name="Weekday" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="weekend" name="Weekend" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </Section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-eco-50 flex items-center justify-center">
          <Icon size={16} className="text-eco-600" />
        </div>
        <h2 className="text-lg font-semibold text-eco-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FlowCard({ step, icon: Icon, title, highlight, children }: {
  step: string; icon: LucideIcon; title: string; highlight?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`relative p-4 rounded-2xl border ${highlight ? 'bg-gradient-to-br from-eco-50 to-eco-100 border-eco-200' : 'bg-card border-eco-100'}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-eco-100 text-eco-700 text-xs font-semibold flex items-center justify-center">{step}</span>
        <Icon size={15} className="text-eco-600" />
        <span className="text-sm font-medium text-eco-700">{title}</span>
        {step !== '5' && <ArrowRight size={14} className="ml-auto text-eco-300 hidden xl:block" />}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-eco-500">{label}</span>
      <span className="font-medium text-eco-900 text-right">{value}</span>
    </div>
  );
}

function Unavailable() {
  return <div className="text-base font-semibold text-clay-500">{UNAVAILABLE}</div>;
}

function ModelCard({ title, dataset, target, metrics, importance, note }: {
  title: string; dataset: string; target: string;
  metrics: { dataset_size: number; mae: number; rmse: number; r2: number };
  importance: { feature: string; importance: number }[];
  note?: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Database size={15} className="text-eco-600" />
        <h3 className="font-semibold text-eco-900 text-sm">{title}</h3>
      </div>
      <p className="text-xs text-eco-400 mb-3">Random Forest Regression · {dataset} · target: {target}</p>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <Metric label="Rows" value={metrics.dataset_size.toLocaleString()} />
        <Metric label="MAE" value={metrics.mae.toFixed(2)} />
        <Metric label="RMSE" value={metrics.rmse.toFixed(2)} />
        <Metric label="R²" value={metrics.r2.toFixed(3)} />
      </div>
      <div className="space-y-1.5">
        {importance.map(fi => (
          <div key={fi.feature} className="flex items-center gap-2 text-xs">
            <span className="w-36 truncate text-eco-600">{fi.feature}</span>
            <div className="flex-1 h-1.5 rounded-full bg-eco-50">
              <div className="h-full rounded-full bg-eco-500" style={{ width: `${fi.importance * 100}%` }} />
            </div>
            <span className="w-10 text-right text-eco-400">{(fi.importance * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      {note && <p className="text-xs text-eco-400 mt-3">{note}</p>}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-eco-50 text-center">
      <div className="text-xs text-eco-400">{label}</div>
      <div className="text-sm font-semibold text-eco-900">{value}</div>
    </div>
  );
}

