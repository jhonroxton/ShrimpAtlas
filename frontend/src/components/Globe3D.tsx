/**
 * Globe3D.tsx — Clean, stable Cesium globe component
 *
 * Known issues this version fixes:
 * - "source image could not be decoded" → use OSM only, no ion/Bing
 * - Token expiry issues → completely token-free
 * - WebGL context issues → explicit container sizing
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { SpeciesDistribution } from '../types'

const OCEAN_PRESETS: Record<string, { lon: number; lat: number; height: number }> = {
  太平洋: { lon: -160, lat: 10,  height: 25_000_000 },
  大西洋: { lon: -40,  lat: 20,  height: 25_000_000 },
  印度洋: { lon: 75,   lat: -10, height: 25_000_000 },
  北冰洋: { lon: 0,    lat: 85,  height: 18_000_000 },
  南大洋: { lon: 0,    lat: -70, height: 22_000_000 },
}

interface Globe3DProps {
  distributions?: SpeciesDistribution[]
  showCurrents?: boolean
  showSpecies?: boolean
  initialCenter?: { lon: number; lat: number; height?: number }
}

export default function Globe3D({
  distributions = [],
  showCurrents = true,
  showSpecies = true,
  initialCenter = { lon: 120, lat: 20, height: 20_000_000 },
}: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef    = useRef<any>(null)
  const cesRef       = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const flyToOcean = useCallback((ocean: string) => {
    const pos = OCEAN_PRESETS[ocean]
    const Ces  = cesRef.current
    const view = viewerRef.current
    if (!Ces || !view || !pos) return
    view.camera.flyTo({
      destination: Ces.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.height),
      duration: 2,
    })
  }, [])

  // ── Initialize Cesium ─────────────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false

    async function init() {
      try {
        // Dynamic import — keeps Cesium out of the main bundle until needed
        const Ces = await import('cesium')
        if (destroyed) return
        cesRef.current = Ces

        if (!containerRef.current) {
          setError('DOM container not found')
          setLoading(false)
          return
        }

        // Explicitly size the container (fixes "canvas not attached" errors)
        const container = containerRef.current
        container.style.width  = '100%'
        container.style.height = '100%'

        // Create viewer with TOKEN-FREE imagery + flat terrain
        const viewer = new Ces.Viewer(container, {
          // OpenStreetMap — free, no token, CORS-enabled
          imageryProvider: new Ces.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            credit: '© OpenStreetMap contributors',
          }),

          // Flat terrain — no external tile requests
          terrainProvider: new Ces.EllipsoidTerrainProvider(),

          // UI: disable everything unnecessary
          baseLayerPicker:      false,
          geocoder:             false,
          homeButton:           true,
          sceneModePicker:       false,
          navigationHelpButton: false,
          animation:            false,
          timeline:             false,
          fullscreenButton:     false,
          selectionIndicator:   false,
          infoBox:              false,

          // Empty credit container (no "Powered by Cesium" box)
          creditContainer: document.createElement('div'),

          // Only request a render when data changes (saves CPU)
          requestRenderMode: true,
          maximumRenderTimeLoops: 10,
        })

        if (destroyed) { viewer.destroy(); return }
        viewerRef.current = viewer

        // ── Visual theming ──────────────────────────────────────────────
        const scene = viewer.scene
        scene.globe.baseColor = Ces.Color.fromCssColorString('#0A1628')
        scene.backgroundColor = Ces.Color.fromCssColorString('#070f1a')
        scene.globe.enableLighting = false
        scene.fog.enabled = true

        // ── Initial camera position ──────────────────────────────────────
        viewer.camera.flyTo({
          destination: Ces.Cartesian3.fromDegrees(
            initialCenter.lon,
            initialCenter.lat,
            initialCenter.height ?? 20_000_000,
          ),
          orientation: {
            heading: Ces.Math.toRadians(0),
            pitch:   Ces.Math.toRadians(-90),
            roll: 0,
          },
          duration: 0,
        })

        // Expose viewer globally for the ocean quick-jump buttons
        ;(window as any)._cesiumViewer = viewer

        setLoading(false)

        // Add data layers
        if (showSpecies)  addPoints(viewer, Ces, distributions)
        if (showCurrents) addCurrents(viewer, Ces)
      } catch (err: any) {
        if (!destroyed) {
          console.error('[Globe3D] init failed:', err)
          setError(err?.message ?? 'Failed to load globe')
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      destroyed = true
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Update layers when props change ───────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    const Ces  = cesRef.current
    if (!viewer || !Ces || loading) return

    // Remove old entities and redraw
    viewer.entities.removeAll()
    if (showSpecies)  addPoints(viewer, Ces, distributions)
    if (showCurrents) addCurrents(viewer, Ces)
    viewer.resize()
  }, [distributions, showCurrents, showSpecies, loading])

  return (
    <div className="relative w-full h-full" style={{ minHeight: 400 }}>
      {/* Cesium container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: '#070f1a' }}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-deep-sea-900/80 pointer-events-none">
          <div className="text-center">
            <div className="text-5xl mb-3 animate-pulse">🌍</div>
            <p className="text-ocean-accent text-sm">正在加载 3D 地球...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-deep-sea-900/90 pointer-events-none">
          <div className="text-center p-6">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-400 text-sm mb-1">地球加载失败</p>
            <p className="text-gray-500 text-xs max-w-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Ocean quick-jump panel */}
      <div className="absolute top-4 left-4 bg-deep-sea-800/90 backdrop-blur border border-deep-sea-600 rounded-lg p-3 space-y-2">
        <p className="text-xs text-gray-400 font-medium">🌊 快速跳转</p>
        {Object.keys(OCEAN_PRESETS).map((ocean) => (
          <button
            key={ocean}
            className="block w-full text-left text-xs text-gray-300 hover:text-ocean-accent transition-colors py-1"
            onClick={() => flyToOcean(ocean)}
          >
            {ocean}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function addPoints(viewer: any, Ces: any, distributions: SpeciesDistribution[]) {
  if (!distributions.length) return
  for (const d of distributions) {
    viewer.entities.add({
      position: Ces.Cartesian3.fromDegrees(d.longitude, d.latitude),
      point: {
        pixelSize:     9,
        color:         d.is_verified
          ? Ces.Color.fromCssColorString('#00D4FF')
          : Ces.Color.fromCssColorString('#7B2FFF'),
        outlineColor:  Ces.Color.WHITE.withAlpha(0.7),
        outlineWidth:  1.5,
      },
    })
  }
}

function addCurrents(viewer: any, Ces: any) {
  const CURRENTS = [
    { name: '黑潮',   type: 'warm', coords: [[130,20],[140,28],[150,35],[165,42],[180,45]] },
    { name: '湾流',   type: 'warm', coords: [[-80,22],[-70,30],[-60,40],[-50,50],[-30,58]] },
    { name: '加利福尼亚寒流', type: 'cold', coords: [[-115,45],[-122,38],[-128,28],[-130,18]] },
    { name: '秘鲁寒流',     type: 'cold', coords: [[-80,-5],[-85,-12],[-90,-18],[-95,-25]] },
    { name: '厄加勒斯暖流', type: 'warm', coords: [[20,-30],[30,-35],[40,-38],[50,-40]] },
  ]
  for (const c of CURRENTS) {
    const color = c.type === 'warm'
      ? Ces.Color.fromCssColorString('#FF6B6B').withAlpha(0.6)
      : Ces.Color.fromCssColorString('#4DABF7').withAlpha(0.6)

    viewer.entities.add({
      name: c.name,
      polyline: {
        positions: Ces.Cartesian3.fromDegreesArrayHeights(
          c.coords.flatMap(([lon, lat]) => [lon, lat, 0]),
        ),
        width: 3,
        material: color,
        arcType: Ces.ArcType.GREAT_CIRCLE,
      },
    })
  }
}
