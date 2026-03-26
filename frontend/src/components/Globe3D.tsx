import { useEffect, useRef, useState, useCallback } from 'react'
import { SpeciesDistribution } from '../types'

type CesiumType = any

interface Globe3DProps {
  distributions?: SpeciesDistribution[]
  showCurrents?: boolean
  showSpecies?: boolean
  onSpeciesClick?: (speciesId: string) => void
  initialCenter?: { lon: number; lat: number; height?: number }
}

const OCEAN_PRESETS: Record<string, { lon: number; lat: number; height: number }> = {
  太平洋:   { lon: -160,  lat: 10,  height: 25_000_000 },
  大西洋:   { lon: -40,   lat: 20,  height: 25_000_000 },
  印度洋:   { lon: 75,    lat: -10, height: 25_000_000 },
  北冰洋:   { lon: 0,     lat: 85,  height: 18_000_000 },
  南大洋:   { lon: 0,     lat: -70, height: 22_000_000 },
}

export default function Globe3D({
  distributions = [],
  showCurrents = true,
  showSpecies = true,
  onSpeciesClick,
  initialCenter = { lon: 120, lat: 20, height: 20_000_000 },
}: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef   = useRef<any>(null)
  const cesiumRef    = useRef<CesiumType>(null)
  const [loading, setLoading] = useState(true)
  const [error,  setError]   = useState<string | null>(null)

  const flyToOcean = useCallback((ocean: string) => {
    const pos  = OCEAN_PRESETS[ocean]
    const Ces   = cesiumRef.current
    const view  = viewerRef.current
    if (!Ces || !view || !pos) return
    view.camera.flyTo({
      destination: Ces.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.height),
      duration: 2,
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const Ces: any = await import('cesium')
        if (cancelled) return
        cesiumRef.current = Ces.default

        if (!containerRef.current) return

        // Use OpenStreetMap imagery (no API key required)
        const OSM = new Ces.default.OpenStreetMapImagery()

        const view = new Ces.default.Viewer(containerRef.current, {
          imageryProvider: OSM,
          // No terrain — use ellipsoid for reliability (no ion token needed)
          terrainProvider: new Ces.default.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: true,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          selectionIndicator: false,
          infoBox: false,
          creditContainer: document.createElement('div'),
        })

        if (cancelled) { view.destroy(); return }

        viewerRef.current = view

        // ── Dark ocean theme ───────────────────────────────────────────────
        view.scene.globe.baseColor = Ces.default.Color.fromCssColorString('#0A1628')
        view.scene.fog.enabled = true
        view.scene.backgroundColor = Ces.default.Color.fromCssColorString('#070f1a')
        view.scene.globe.enableLighting = false

        // Initial camera position
        view.camera.flyTo({
          destination: Ces.default.Cartesian3.fromDegrees(
            initialCenter.lon,
            initialCenter.lat,
            initialCenter.height ?? 20_000_000,
          ),
          orientation: {
            heading: Ces.default.Math.toRadians(0),
            pitch:   Ces.default.Math.toRadians(-90),
            roll: 0,
          },
          duration: 0,
        })

        // Expose for external fly-to calls
        ;(window as any)._cesiumViewer = view

        setLoading(false)

        if (showSpecies)  addDistributionPoints(view, Ces.default, distributions, onSpeciesClick)
        if (showCurrents) addOceanCurrents(view, Ces.default)
      } catch (err: any) {
        if (!cancelled) {
          console.error('[Globe3D] Cesium init error:', err)
          setError(err?.message ?? 'Failed to load 3D globe')
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render layers when data changes
  useEffect(() => {
    const view = viewerRef.current
    const Ces  = cesiumRef.current
    if (!view || !Ces || loading) return

    // Remove old entities
    view.entities.removeAll()
    if (showSpecies)  addDistributionPoints(view, Ces, distributions, onSpeciesClick)
    if (showCurrents) addOceanCurrents(view, Ces)
  }, [distributions, showCurrents, showSpecies, loading])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-deep-sea-900/80">
          <div className="text-center">
            <div className="text-5xl mb-3 animate-pulse">🌍</div>
            <p className="text-ocean-accent text-sm">正在加载 3D 地球...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-deep-sea-900/90">
          <div className="text-center p-6">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-400 text-sm mb-2">地球加载失败</p>
            <p className="text-gray-500 text-xs max-w-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Quick-jump controls */}
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function createShrimpIcon(verified: boolean): string {
  const color = verified ? '#00D4FF' : '#7B2FFF'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="${color}" opacity="0.85"/><circle cx="16" cy="16" r="5" fill="${color}"/></svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

function addDistributionPoints(
  viewer: any,
  Ces: any,
  distributions: SpeciesDistribution[],
  onClick?: (id: string) => void,
) {
  for (const dist of distributions) {
    viewer.entities.add({
      position: Ces.Cartesian3.fromDegrees(dist.longitude, dist.latitude),
      billboard: {
        image: createShrimpIcon(dist.is_verified),
        width: 28,
        height: 28,
        verticalOrigin: Ces.VerticalOrigin.BOTTOM,
      },
      properties: {
        speciesId: dist.species_id,
        locationName: dist.location_name,
      },
    })
    if (onClick) {
      viewer.clicked = new Ces.Event()
      viewer.clicked.addEventListener(() => {
        onClick(dist.species_id)
      })
    }
  }
}

function addOceanCurrents(viewer: any, Ces: any) {
  const currents = [
    {
      name: '黑潮 (Kuroshio)',
      type: 'warm',
      coords: [[130, 20], [140, 28], [150, 35], [165, 42], [180, 45]],
    },
    {
      name: '湾流 (Gulf Stream)',
      type: 'warm',
      coords: [[-80, 22], [-70, 30], [-60, 40], [-50, 50], [-30, 58]],
    },
    {
      name: '加利福尼亚寒流',
      type: 'cold',
      coords: [[-115, 45], [-122, 38], [-128, 28], [-130, 18]],
    },
    {
      name: '秘鲁寒流',
      type: 'cold',
      coords: [[-80, -5], [-85, -12], [-90, -18], [-95, -25]],
    },
    {
      name: '厄加勒斯暖流',
      type: 'warm',
      coords: [[20, -30], [30, -35], [40, -38], [50, -40]],
    },
  ]

  for (const curr of currents) {
    const color = curr.type === 'warm'
      ? Ces.Color.fromCssColorString('#FF6B6B').withAlpha(0.7)
      : Ces.Color.fromCssColorString('#4DABF7').withAlpha(0.7)

    viewer.entities.add({
      name: curr.name,
      polyline: {
        positions: Ces.Cartesian3.fromDegreesArrayHeights(
          curr.coords.flatMap((c) => [c[0], c[1], 0]),
        ),
        width: 3,
        material: color,
        arcType: Ces.ArcType.GREAT_CIRCLE,
      },
    })
  }
}
