/**
 * useCamera.ts — Camera height → LOD level hook
 *
 * Thresholds:
 *   > 8M m  → 'world'    (glowing dots, no labels)
 *   1M–8M   → 'region'   (species dots + country labels)
 *   < 1M    → 'species'  (full image billboards)
 */
import { useEffect } from 'react'
import { useGlobeStore } from '../store/globeStore'
import type { LODLevel } from '../types/shrimp'

const WORLD_M  = 8_000_000
const REGION_M = 1_000_000

export function computeLOD(height: number): LODLevel {
  if (height > WORLD_M)  return 'world'
  if (height > REGION_M) return 'region'
  return 'species'
}

export function useCamera(viewer: any, cesRef: any) {
  const setCameraHeight = useGlobeStore(s => s.setCameraHeight)
  const setLODLevel    = useGlobeStore(s => s.setLODLevel)

  useEffect(() => {
    if (!viewer) return

    const handler = () => {
      const h = viewer.camera.positionCartographic.height
      setCameraHeight(h)
      setLODLevel(computeLOD(h))
    }

    viewer.camera.changed.addEventListener(handler)
    // Fire once immediately
    handler()

    return () => viewer.camera.changed.removeEventListener(handler)
  }, [viewer, cesRef])
}
