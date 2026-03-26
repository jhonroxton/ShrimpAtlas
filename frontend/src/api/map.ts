import apiClient from './client'
import type { OceanCurrent } from '../types'

export const mapApi = {
  getDistributions: async (params?: {
    min_lat?: number
    max_lat?: number
    min_lng?: number
    max_lng?: number
  }): Promise<GeoJSON.FeatureCollection> => {
    const { data } = await apiClient.get('/map/distributions', { params })
    return data
  },

  getOceanCurrents: async (): Promise<OceanCurrent[]> => {
    const { data } = await apiClient.get('/map/ocean-currents')
    return data
  },
}
