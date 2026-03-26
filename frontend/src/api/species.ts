import apiClient from './client'
import type { ShrimpSpecies, SpeciesDistribution, ApiResponse } from '../types'

// Raw WoRMS species record shape (subset of data/worms/species/*.json)
export interface WormsSpeciesRecord {
  worms_aphia_id: number
  valid_aphia_id: number
  scientific_name: string
  valid_name: string
  authority: string
  family: string
  genus: string
  order: string
  class: string
  status: string
  is_marine: number
  habitat: string | null
  taxon_rank: string
  kingdom: string
  phylum: string
  url: string
}

// Map a WoRMS record to the ShrimpSpecies interface
export function mapWormsToShrimp(record: WormsSpeciesRecord): ShrimpSpecies {
  return {
    id: String(record.worms_aphia_id),
    cn_name: record.scientific_name, // cn_name not in WoRMS; falls back to scientific_name
    en_name: '',
    scientific_name: record.scientific_name,
    family: record.family,
    genus: record.genus,
    max_length_cm: 0,
    color_description: '',
    habitat: 'coastal',
    temperature_zone: 'tropical',
    diet: '',
    is_edible: false,
    edible_regions: [],
    fishing_type: 'wild',
    iucn_status: 'DD',
    threats: [],
    images: [],
    created_at: '',
  }
}

export const speciesApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    habitat?: string
    temperature_zone?: string
    iucn_status?: string
    is_edible?: boolean
  }): Promise<ApiResponse<ShrimpSpecies[]>> => {
    const { data } = await apiClient.get('/species', { params })
    return data
  },

  getById: async (id: string): Promise<ShrimpSpecies> => {
    const { data } = await apiClient.get(`/species/${id}`)
    return data
  },

  getDistributions: async (id: string): Promise<SpeciesDistribution[]> => {
    const { data } = await apiClient.get(`/species/${id}/distributions`)
    return data
  },

  search: async (q: string): Promise<ShrimpSpecies[]> => {
    const { data } = await apiClient.get('/species/search', { params: { q } })
    return data
  },

  /** Fetch raw WoRMS species list from the backend — works without a DB */
  getWormsSpecies: async (): Promise<WormsSpeciesRecord[]> => {
    const { data } = await apiClient.get('/species-worms')
    return data
  },
}
