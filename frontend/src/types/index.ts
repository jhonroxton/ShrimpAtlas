export interface ShrimpSpecies {
  id: string
  cn_name: string
  en_name: string
  scientific_name: string
  family: string
  genus: string
  max_length_cm: number
  color_description: string
  habitat: 'deep_sea' | 'coastal' | 'freshwater' | 'brackish'
  temperature_zone: 'tropical' | 'temperate' | 'cold'
  diet: string
  is_edible: boolean
  edible_regions: string[]
  fishing_type: 'wild' | 'farmed' | 'both'
  iucn_status: 'CR' | 'EN' | 'VU' | 'NT' | 'LC' | 'DD'
  threats: string[]
  images: string[]
  created_at: string
}

export interface SpeciesDistribution {
  id: string
  species_id: string
  latitude: number
  longitude: number
  location_name: string
  depth_m: number
  is_verified: boolean
  source: string
}

export interface OceanCurrent {
  id: string
  name: string
  type: 'warm' | 'cold'
  coordinates: [number, number][]
  season: 'summer' | 'winter' | 'year_round'
}

export interface ApiResponse<T> {
  data: T
  total?: number
  page?: number
  page_size?: number
}
