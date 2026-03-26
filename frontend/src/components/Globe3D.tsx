/**
 * Globe3D.tsx — Stable, token-free Cesium globe
 *
 * Key design decisions:
 * - Token-free: OpenStreetMap via UrlTemplateImageryProvider
 * - Flat terrain: EllipsoidTerrainProvider (no tile requests)
 * - requestRenderMode for performance
 * - All Cesium classes use dynamic import (ES module, named exports)
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
  onSpeciesClick?: (id: string) => void
  initialCenter?: { lon: number; lat: number; height?: number }
}

export default function Globe3D({
  distributions = [],
  showCurrents = true,
  showSpecies = true,
  initialCenter = { lon: 120, lat: 20, height: 20_000_000 },
}: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // ── Initialize Cesium ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const Ces = await import('cesium')
        if (cancelled || !containerRef.current) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Cesium: any = Ces
        cesRef.current = Cesium

        const container = containerRef.current
        container.style.width  = '100%'
        container.style.height = '100%'

        // Credit container must be attached to DOM
        const creditContainer = document.createElement('div')
        creditContainer.style.display = 'none'
        container.appendChild(creditContainer)

        // Create viewer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viewer: any = new Cesium.Viewer(container, {
          imageryProvider: new Cesium.UrlTemplateImageryProvider({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            credit: '© OpenStreetMap contributors',
            maximumLevel: 19,
          }),
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          selectionIndicator: false,
          infoBox: false,
          creditContainer,
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
        })

        if (cancelled) { viewer.destroy(); return }
        viewerRef.current = viewer

        // Dark ocean theme
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0A1628')
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#070f1a')
        viewer.scene.globe.enableLighting = false

        // Fly to initial position
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            initialCenter.lon,
            initialCenter.lat,
            initialCenter.height ?? 20_000_000,
          ),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
          duration: 0,
        })

        setLoading(false)

        // Add data layers
        if (showSpecies && distributions.length) {
          addDistributionPoints(viewer, Cesium, distributions)
        }
        if (showCurrents) {
          addOceanCurrents(viewer, Cesium)
        }

        viewer.scene.requestRender()

      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        console.error('[Globe3D] init failed:', err)
        if (viewerRef.current) {
          try { viewerRef.current.destroy() } catch { /* ignore */ }
          viewerRef.current = null
        }
        setError(`地球加载失败: ${message}`)
        setLoading(false)
      }
    }

    // Defer to next frame so WebGL context is ready
    const rafId = requestAnimationFrame(() => { Promise.resolve().then(init) })
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      if (viewerRef.current) {
        try { viewerRef.current.destroy() } catch { /* ignore */ }
        viewerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Update layers when props change ────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    const Ces = cesRef.current
    if (!viewer || !Ces || loading) return
    viewer.entities.removeAll()
    if (showSpecies && distributions.length) addDistributionPoints(viewer, Ces, distributions)
    if (showCurrents) addOceanCurrents(viewer, Ces)
    viewer.scene?.requestRender()
  }, [distributions, showCurrents, showSpecies, loading])

  return (
    <div className="relative w-full h-full" style={{ minHeight: 400 }}>
      <div ref={containerRef} className="w-full h-full" style={{ background: '#070f1a' }} />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-deep-sea-900/80 pointer-events-none">
          <div className="text-center">
            <div className="text-5xl mb-3 animate-pulse">🌍</div>
            <p className="text-ocean-accent text-sm">正在加载 3D 地球...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-deep-sea-900/90 pointer-events-none">
          <div className="text-center p-6">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-400 text-sm mb-1">地球加载失败</p>
            <p className="text-gray-500 text-xs max-w-xs">{error}</p>
          </div>
        </div>
      )}

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

// ── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addDistributionPoints(viewer: any, Ces: any, distributions: SpeciesDistribution[]) {
  if (!distributions.length) return
  distributions.forEach((d) => {
    viewer.entities.add({
      position: Ces.Cartesian3.fromDegrees(d.longitude, d.latitude),
      point: {
        pixelSize: 10,
        color: d.is_verified
          ? Ces.Color.fromCssColorString('#00D4FF')
          : Ces.Color.fromCssColorString('#7B2FFF'),
        outlineColor: Ces.Color.WHITE.withAlpha(0.8),
        outlineWidth: 2,
      },
    })
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addOceanCurrents(viewer: any, Ces: any) {
  const CURRENTS = [
    { name: '黑潮',   type: 'warm', coords: [[130,20],[140,28],[150,35],[165,42],[180,45]] },
    { name: '湾流',   type: 'warm', coords: [[-80,22],[-70,30],[-60,40],[-50,50],[-30,58]] },
    { name: '加利福尼亚寒流', type: 'cold', coords: [[-115,45],[-122,38],[-128,28],[-130,18]] },
    { name: '秘鲁寒流',     type: 'cold', coords: [[-80,-5],[-85,-12],[-90,-18],[-95,-25]] },
    { name: '厄加勒斯暖流', type: 'warm', coords: [[20,-30],[30,-35],[40,-38],[50,-40]] },
  ]
  CURRENTS.forEach((c) => {
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
        arcType: Ces.ArcType.GEODESIC,
      },
    })
  })
}
