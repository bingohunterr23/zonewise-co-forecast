export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
}

export interface Zone {
  id: number;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  traffic_category: string;
}

export interface LiveReading {
  zone_id: number;
  zone_name: string;
  region: string;
  traffic_category: string;
  latitude: number;
  longitude: number;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  wind_speed: number | null;
  cloud_coverage: number | null;
  aqi: number | null;
  aqi_category: string | null;
  co: number | null;
  no?: number | null;
  no2: number | null;
  o3: number | null;
  pm2_5: number | null;
  pm10: number | null;
  source: string;
  fetched_at: string | null;
  error?: string | null;
  weather_error?: string | null;
  air_error?: string | null;
  stale?: boolean;
}

export interface ModelMetrics {
  dataset_size: number;
  training_records: number;
  testing_records: number;
  mae: number;
  rmse: number;
  r2: number;
  target_column: string;
  dataset_files: string[];
}

export interface ModelStatus {
  available: boolean;
  model_type: string | null;
  target: string | null;
  has_temporal_data: boolean;
  training_timestamp: string | null;
  message: string | null;
}

export interface DatasetInfo {
  name: string;
  source: string;
  available: boolean;
  columns: string[];
  shape: number[] | null;
}

export interface DatasetsResponse {
  chetna: DatasetInfo;
  kaggle: DatasetInfo;
  kaggle_url: string | null;
  kaggle_instructions: string | null;
}

export interface HealthResponse {
  status: string;
  model_ready: boolean;
  database: string;
  weather_api: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface ModelFeatures {
  feature_names: string[];
  feature_importance: FeatureImportance[];
  target_column: string;
}

export interface PredictCO2Request {
  features: Record<string, number>;
}

export interface PredictCO2Response {
  predicted_co2: number;
  model_name: string;
  feature_names: string[];
}

export interface ZoneLivePrediction {
  zone_id: number;
  zone_name: string;
  predicted_co2: number | null;
  model: string;
  prediction_type: string;
  matched_features: string[];
  missing_features: string[];
  live_reading: LiveReading | null;
  message: string | null;
}

export interface TreeImpactRequest {
  number_of_trees: number;
  plantation_area_sqm: number;
}

export interface TreeImpactResponse {
  number_of_trees: number;
  plantation_area_sqm: number;
  annual_co2_absorption_kg: number;
  absorption_factor_kg_per_tree_per_year: number;
  annual_co2_absorption_tons: number;
  equivalent_car_km_per_year: number;
  recommendation: string;
}

export interface CategoryEmission {
  category: string;
  co2e_kg: number;
  percentage: number;
}

export interface CarbonFootprintRequest {
  vehicle_type: string;
  daily_distance_km: number;
  travel_frequency: string;
  fuel_type: string | null;
  fuel_consumption_per_month: number;
  electricity_usage_kwh_per_month: number;
}

export interface CarbonFootprintResponse {
  transportation_emissions_kg: number;
  fuel_emissions_kg: number;
  electricity_emissions_kg: number;
  total_co2e_kg: number;
  total_co2e_tons: number;
  category_breakdown: CategoryEmission[];
  recommendations: string[];
}

export interface GreenCoverZone {
  zone_id: number;
  zone_name: string;
  region: string;
  latitude: number;
  longitude: number;
  green_cover_percentage: number | null;
  ndvi: number | null;
  source: string;
  configured: boolean;
}

export interface GreenCoverResponse {
  provider: string;
  configured: boolean;
  setup_message: string | null;
  zones: GreenCoverZone[];
}

export const REGIONS = ['Silk Board Region', 'Lalbagh Region'] as const;
export type Region = typeof REGIONS[number];

export const ZONES_SEED: Zone[] = [
  { id: 1, name: 'Silk Board Junction', region: 'Silk Board Region', latitude: 12.9177, longitude: 77.6230, traffic_category: 'Heavy Traffic' },
  { id: 2, name: 'BTM Layout Entry', region: 'Silk Board Region', latitude: 12.9160, longitude: 77.6101, traffic_category: 'Normal Traffic' },
  { id: 3, name: 'HSR Layout Side', region: 'Silk Board Region', latitude: 12.9116, longitude: 77.6412, traffic_category: 'Heavy Traffic' },
  { id: 4, name: 'Bommanahalli Road', region: 'Silk Board Region', latitude: 12.9082, longitude: 77.6205, traffic_category: 'Heavy Traffic' },
  { id: 5, name: 'Lalbagh Main Gate', region: 'Lalbagh Region', latitude: 12.9507, longitude: 77.5848, traffic_category: 'Normal Traffic' },
  { id: 6, name: 'Basavanagudi', region: 'Lalbagh Region', latitude: 12.9417, longitude: 77.5738, traffic_category: 'Normal Traffic' },
  { id: 7, name: 'Jayanagar 4th Block', region: 'Lalbagh Region', latitude: 12.9250, longitude: 77.5938, traffic_category: 'Normal Traffic' },
  { id: 8, name: 'KR Road Side', region: 'Lalbagh Region', latitude: 12.9445, longitude: 77.5801, traffic_category: 'Heavy Traffic' },
];
