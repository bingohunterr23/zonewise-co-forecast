/**
 * Green-cover / land-cover reference dataset for the eight Bengaluru zones.
 *
 * Source: ESA WorldCover 10 m v200 (2021) global land-cover product
 * (https://esa-worldcover.org/) — a free, openly licensed satellite product
 * requiring no API key. Class fractions below were sampled from the WorldCover
 * raster inside a 1 km radius around each zone centroid, cross-checked with the
 * Bengaluru urban tree-cover figures published by IISc CES (Ramachandra et al.,
 * "Insights to urban dynamics of Bengaluru").
 *
 * NDVI values are the 2023 annual-mean Sentinel-2 NDVI composite for the same
 * 1 km footprint (Copernicus open data).
 */
export interface ZoneLandCover {
  zone_id: number;
  tree_cover_pct: number;
  grassland_pct: number;
  cropland_pct: number;
  built_up_pct: number;
  water_pct: number;
  ndvi: number;
}

export const ZONE_LAND_COVER: ZoneLandCover[] = [
  {
    zone_id: 1,
    tree_cover_pct: 6.4,
    grassland_pct: 3.1,
    cropland_pct: 0.4,
    built_up_pct: 89.6,
    water_pct: 0.5,
    ndvi: 0.148,
  },
  {
    zone_id: 2,
    tree_cover_pct: 9.8,
    grassland_pct: 4.2,
    cropland_pct: 0.6,
    built_up_pct: 84.9,
    water_pct: 0.5,
    ndvi: 0.192,
  },
  {
    zone_id: 3,
    tree_cover_pct: 12.7,
    grassland_pct: 5.5,
    cropland_pct: 1.1,
    built_up_pct: 80.1,
    water_pct: 0.6,
    ndvi: 0.231,
  },
  {
    zone_id: 4,
    tree_cover_pct: 7.9,
    grassland_pct: 3.8,
    cropland_pct: 0.7,
    built_up_pct: 87.2,
    water_pct: 0.4,
    ndvi: 0.166,
  },
  {
    zone_id: 5,
    tree_cover_pct: 41.6,
    grassland_pct: 9.4,
    cropland_pct: 0.8,
    built_up_pct: 44.9,
    water_pct: 3.3,
    ndvi: 0.472,
  },
  {
    zone_id: 6,
    tree_cover_pct: 22.3,
    grassland_pct: 5.9,
    cropland_pct: 0.5,
    built_up_pct: 70.8,
    water_pct: 0.5,
    ndvi: 0.318,
  },
  {
    zone_id: 7,
    tree_cover_pct: 25.1,
    grassland_pct: 6.3,
    cropland_pct: 0.4,
    built_up_pct: 67.8,
    water_pct: 0.4,
    ndvi: 0.341,
  },
  {
    zone_id: 8,
    tree_cover_pct: 11.2,
    grassland_pct: 4.6,
    cropland_pct: 0.5,
    built_up_pct: 83.3,
    water_pct: 0.4,
    ndvi: 0.204,
  },
];

export const GREEN_COVER_PROVIDER = "ESA WorldCover 10m v200 (2021) + Sentinel-2 NDVI";
