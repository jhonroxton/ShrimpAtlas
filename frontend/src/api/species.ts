import apiClient from './client'
import type { ShrimpSpecies, SpeciesDistribution, ApiResponse } from '../types'

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
}
