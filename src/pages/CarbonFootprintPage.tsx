import { useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Footprints, Calculator, Car, Fuel, Zap, Info, Lightbulb } from 'lucide-react';
import { carbonFootprintApi } from '@/services/api';
import type { CarbonFootprintResponse } from '@/types';
import { Card, PageHeader } from '@/components/ui';

const VEHICLE_TYPES = [
  { value: 'petrol_car', label: 'Petrol Car' },
  { value: 'diesel_car', label: 'Diesel Car' },
  { value: 'cng_car', label: 'CNG Car' },
  { value: 'electric_car', label: 'Electric Car' },
  { value: 'bus', label: 'Bus' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'two_wheeler', label: 'Two Wheeler' },
  { value: 'none', label: 'No Vehicle' },
];

const FUEL_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'cng', label: 'CNG' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const PIE_COLORS = ['#2e9161', '#c08d5a', '#54ae80'];

export function CarbonFootprintPage() {
  const [vehicleType, setVehicleType] = useState('petrol_car');
  const [distance, setDistance] = useState(30);
  const [frequency, setFrequency] = useState('daily');
  const [fuelType, setFuelType] = useState('none');
  const [fuelConsumption, setFuelConsumption] = useState(0);
  const [electricity, setElectricity] = useState(200);
  const [result, setResult] = useState<CarbonFootprintResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCalculate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await carbonFootprintApi.calculate({
        vehicle_type: vehicleType,
        daily_distance_km: distance,
        travel_frequency: frequency,
        fuel_type: fuelType,
        fuel_consumption_per_month: fuelConsumption,
        electricity_usage_kwh_per_month: electricity,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const pieData = result?.category_breakdown.map(c => ({
    name: c.category,
    value: c.co2e_kg,
    percentage: c.percentage,
  })) || [];

  const barData = result?.category_breakdown.map(c => ({
    name: c.category,
    value: c.co2e_kg,
  })) || [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Carbon Footprint Calculator"
        subtitle="Estimate your personal CO₂ emissions across transportation, fuel, and electricity"
      />

      <div className="mb-6 p-4 rounded-xl bg-eco-50 border border-eco-100 flex items-start gap-3">
        <Info size={18} className="text-eco-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-eco-700">
          Calculations are estimates based on documented emission factors from EPA and IPCC guidelines.
          All factors are configurable in the backend via environment variables.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input form */}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Calculator size={20} className="text-eco-600" />
            <h3 className="font-semibold text-eco-900">Your Activities</h3>
          </div>

          {/* Transportation */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Car size={16} className="text-eco-500" />
              <h4 className="text-sm font-semibold text-eco-700">Transportation</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-eco-600 mb-1">Vehicle Type</label>
                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="input-field py-2 text-sm">
                  {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-eco-600 mb-1">Frequency</label>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="input-field py-2 text-sm">
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-eco-600 mb-1">Distance per trip (km)</label>
                <input type="number" min="0" step="0.1" value={distance} onChange={(e) => setDistance(parseFloat(e.target.value) || 0)} className="input-field py-2 text-sm" />
              </div>
            </div>
          </div>

          {/* Fuel */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Fuel size={16} className="text-eco-500" />
              <h4 className="text-sm font-semibold text-eco-700">Fuel (additional)</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-eco-600 mb-1">Fuel Type</label>
                <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className="input-field py-2 text-sm">
                  {FUEL_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-eco-600 mb-1">Monthly Consumption (L)</label>
                <input type="number" min="0" step="0.1" value={fuelConsumption} onChange={(e) => setFuelConsumption(parseFloat(e.target.value) || 0)} className="input-field py-2 text-sm" />
              </div>
            </div>
          </div>

          {/* Electricity */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-eco-500" />
              <h4 className="text-sm font-semibold text-eco-700">Electricity</h4>
            </div>
            <div>
              <label className="block text-xs font-medium text-eco-600 mb-1">Monthly Usage (kWh)</label>
              <input type="number" min="0" step="1" value={electricity} onChange={(e) => setElectricity(parseFloat(e.target.value) || 0)} className="input-field py-2 text-sm" />
            </div>
          </div>

          <button onClick={handleCalculate} disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Calculating...' : 'Calculate Footprint'}
          </button>

          {error && <div className="mt-3 p-3 rounded-lg bg-clay-50 text-clay-500 text-sm">{error}</div>}
        </Card>

        {/* Results */}
        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Footprints size={20} className="text-eco-600" />
              <h3 className="font-semibold text-eco-900">Your Annual Footprint</h3>
            </div>

            {result ? (
              <div className="animate-slide-up">
                <div className="text-center py-4 mb-4">
                  <p className="text-4xl font-bold text-eco-700">{result.total_co2e_tons}</p>
                  <p className="text-sm text-eco-500 mt-1">tons CO₂e per year</p>
                  <p className="text-xs text-eco-400 mt-0.5">{result.total_co2e_kg.toLocaleString()} kg CO₂e</p>
                </div>

                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #bbe1c9', fontSize: '12px' }} formatter={(v) => `${Number(v)} kg`} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-eco-300">
                <Footprints size={40} className="mb-3" />
                <p className="text-sm">Fill in your activities to calculate</p>
              </div>
            )}
          </Card>

          {result && (
            <>
              <Card>
                <h4 className="font-semibold text-eco-900 mb-3">Category Breakdown</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#dcf0e3" />
                    <XAxis type="number" stroke="#54ae80" fontSize={11} tick={{ fill: '#1f754d' }} />
                    <YAxis type="category" dataKey="name" stroke="#54ae80" fontSize={11} tick={{ fill: '#1f754d' }} width={90} />
                    <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #bbe1c9', fontSize: '12px' }} formatter={(v) => `${Number(v)} kg`} />
                    <Bar dataKey="value" fill="#2e9161" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={18} className="text-warm-600" />
                  <h4 className="font-semibold text-eco-900">Recommendations</h4>
                </div>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-eco-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-eco-500 mt-1.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
