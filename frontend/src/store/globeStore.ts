/**
 * globeStore.ts — Global state for the 3D globe
 * Uses Zustand for minimal, reactive state management
 */
import { create } from 'zustand'
import type { SpeciesDistribution, SpeciesDetail, LODLevel, LayerVisibility } from '../types/shrimp'

interface GlobeState {
  // Data
  distributions: SpeciesDistribution[]
  speciesImages: Record<string, string>      // species_id → /species-images/Genus_species/1.jpg
  selectedSpecies: SpeciesDetail | null
  hoveredSpeciesId: string | null

  // UI state
  layerVisibility: LayerVisibility
  lodLevel: LODLevel
  isLoading: boolean
  error: string | null

  // Camera
  cameraHeight: number

  // Selected distribution point
  selectedPoint: SpeciesDistribution | null

  // Actions
  setDistributions:    (ds: SpeciesDistribution[]) => void
  setSpeciesImages:     (imgs: Record<string, string>) => void
  setSelectedSpecies:   (sp: SpeciesDetail | null) => void
  setHoveredSpecies:    (id: string | null) => void
  setLayerVisibility:   (v: Partial<LayerVisibility>) => void
  setLODLevel:          (l: LODLevel) => void
  setLoading:           (b: boolean) => void
  setError:             (e: string | null) => void
  setCameraHeight:      (h: number) => void
  setSelectedPoint:     (p: SpeciesDistribution | null) => void
}

export const useGlobeStore = create<GlobeState>((set) => ({
  distributions:    [],
  speciesImages:    {},
  selectedSpecies:  null,
  hoveredSpeciesId: null,

  layerVisibility: { shrimp: true, currents: true, labels: false },

  lodLevel:        'world',
  isLoading:       true,
  error:           null,
  cameraHeight:    20_000_000,
  selectedPoint:   null,

  setDistributions:    (ds) => set({ distributions: ds }),
  setSpeciesImages:    (imgs) => set({ speciesImages: imgs }),
  setSelectedSpecies:  (sp) => set({ selectedSpecies: sp }),
  setHoveredSpecies:  (id) => set({ hoveredSpeciesId: id }),
  setLayerVisibility: (v) => set(s => ({ layerVisibility: { ...s.layerVisibility, ...v } })),
  setLODLevel:        (l) => set({ lodLevel: l }),
  setLoading:         (b) => set({ isLoading: b }),
  setError:           (e) => set({ error: e }),
  setCameraHeight:    (h) => set({ cameraHeight: h }),
  setSelectedPoint:   (p) => set({ selectedPoint: p }),
}))
