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

const CN_NAME_MAP: Record<string, string> = {
  'Penaeus vannamei': '南美白对虾',
  'Penaeus monodon': '斑节对虾',
  'Penaeus chinensis': '中国对虾',
  'Penaeus japonicus': '日本对虾',
  'Penaeus merguiensis': '墨吉对虾',
  'Penaeus indicus': '印度对虾',
  'Penaeus subtilis': '巴西对虾',
  'Penaeus setiferus': '美洲白对虾',
  'Penaeus aztecus': '褐色对虾',
  'Penaeus duorarum': '粉红对虾',
  'Metapenaeus ensis': '短沟对虾',
  'Metapenaeus bennettae': '澳洲草虾',
  'Trachysalambria curvirostris': '竹节虾',
  'Macrobrachium rosenbergii': '罗氏沼虾',
  'Macrobrachium nipponense': '日本沼虾',
  'Macrobrachium carcinus': '美洲大沼虾',
  'Neocaridina denticulata': '樱桃虾',
  'Crangon crangon': '欧洲褐虾',
  'Pandalus borealis': '北极甜虾',
  'Pandalus montagui': '粉红虾',
  'Pandalus jordani': '太平洋粉红虾',
  'Hippolyte inermis': '海草虾',
  'Lysmata seticaudata': '清洁虾',
  'Lysmata debelius': '火焰清洁虾',
  'Lysmata amboinensis': '白纹清洁虾',
  'Pasiphaea japonica': '日本玻璃虾',
  'Pasiphaea sivado': '普通玻璃虾',
  'Acetes japonicus': '樱花虾',
  'Acetes intermedius': '中型樱虾',
  'Plesiopenaeus edwardsianus': '深红虾',
  'Alpheus heterochaelis': '枪虾',
  'Alpheus bellimanus': '壮美枪虾',
  'Stenopus hispidus': '毛刷清洁虾',
  'Processa edulis': '荷兰虾',
}

const EN_NAME_MAP: Record<string, string> = {
  'Penaeus vannamei': 'Whiteleg Shrimp',
  'Penaeus monodon': 'Giant Tiger Prawn',
  'Penaeus chinensis': 'Chinese Shrimp',
  'Penaeus japonicus': 'Japanese Shrimp',
  'Penaeus merguiensis': 'Banana Shrimp',
  'Penaeus indicus': 'Indian Shrimp',
  'Penaeus subtilis': 'Brown Shrimp',
  'Penaeus setiferus': 'Pacific White Shrimp',
  'Penaeus aztecus': 'Brown Shrimp',
  'Penaeus duorarum': 'Pink Shrimp',
  'Metapenaeus ensis': 'Green Tail Shrimp',
  'Metapenaeus bennettae': 'Greasyback Shrimp',
  'Trachysalambria curvirostris': 'Ocean Shrimp',
  'Macrobrachium rosenbergii': 'Giant Freshwater Prawn',
  'Macrobrachium nipponense': 'Japanese Freshwater Shrimp',
  'Macrobrachium carcinus': 'American Giant Freshwater Shrimp',
  'Neocaridina denticulata': 'Cherry Shrimp',
  'Crangon crangon': 'European Brown Shrimp',
  'Pandalus borealis': 'Northern Prawn',
  'Pandalus montagui': 'Pink Shrimp',
  'Lysmata seticaudata': 'Cleaner Shrimp',
  'Lysmata debelius': 'Fire Cleaner Shrimp',
  'Lysmata amboinensis': 'White-spot Cleaner Shrimp',
  'Acetes japonicus': 'Akiami Paste Shrimp',
  'Plesiopenaeus edwardsianus': 'Scarlet Shrimp',
  'Alpheus heterochaelis': 'Snapping Shrimp',
  'Alpheus bellimanus': 'Major Pistol Shrimp',
  'Stenopus hispidus': 'Banded Coral Shrimp',
  'Processa edulis': 'Dutch Shrimp',
}

// Map a WoRMS record to the ShrimpSpecies interface
export function mapWormsToShrimp(record: WormsSpeciesRecord): ShrimpSpecies {
  return {
    id: String(record.worms_aphia_id),
    cn_name: CN_NAME_MAP[record.scientific_name] || record.scientific_name,
    en_name: EN_NAME_MAP[record.scientific_name] || '',
    scientific_name: record.scientific_name,
    family: record.family || '',
    genus: record.genus || '',
    max_length_cm: 0,
    color_description: '',
    habitat: record.is_marine ? 'coastal' : 'freshwater',
    temperature_zone: 'temperate',
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

/** Standalone fetch of raw WoRMS data from backend API — works without DB */
export async function getWormsSpecies(): Promise<WormsSpeciesRecord[]> {
  const { data } = await apiClient.get('/species-worms')
  return data
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
}
