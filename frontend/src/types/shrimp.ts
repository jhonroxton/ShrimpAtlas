// ── Core domain types ─────────────────────────────────────────────────────────

export interface SpeciesDistribution {
  id: string
  species_id: string
  latitude: number
  longitude: number
  location_name?: string
  depth_m?: number
  is_verified: boolean
  source: string
}

export interface GeoJSONFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    id: string
    species_id: string
    location_name?: string
    depth_m?: number
    is_verified: boolean
    source: string
  }
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

// ── IUCN Status colors ────────────────────────────────────────────────────────
export const IUCN_COLORS: Record<string, string> = {
  EX:  '#ff0000',   // Extinct
  EW:  '#ff8c00',   // Extinct in the Wild
  CR:  '#ff4444',   // Critically Endangered
  EN:  '#ff8800',   // Endangered
  VU:  '#ffcc00',   // Vulnerable
  NT:  '#ccdd00',   // Near Threatened
  LC:  '#44cc44',   // Least Concern
  DD:  '#888888',   // Data Deficient
  NE:  '#cccccc',   // Not Evaluated
}
export const IUCN_LABELS: Record<string, string> = {
  EX: '已灭绝', EW: '野外灭绝', CR: '极危', EN: '濒危',
  VU: '易危',   NT: '近危',   LC: '无危', DD: '数据不足', NE: '未评估',
}

// ── Species detail (from API) ────────────────────────────────────────────────
export interface SpeciesDetail {
  id: string
  scientific_name: string
  cn_name: string
  en_name: string
  family: string
  genus: string
  iucn_status: keyof typeof IUCN_COLORS
  images: string[]
  habitat: string
  temperature_zone: string
  is_edible: boolean
  max_length_cm?: number
}

// ── Globe UI state ───────────────────────────────────────────────────────────
export type LODLevel = 'world' | 'region' | 'species'
export type LayerVisibility = {
  shrimp: boolean
  currents: boolean
  labels: boolean
}

// ── Cesium viewer instance (opaque handle) ──────────────────────────────────
export interface GlobeCamera {
  lon: number
  lat: number
  height: number
}
