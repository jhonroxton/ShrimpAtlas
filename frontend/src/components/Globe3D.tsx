import { useEffect, useRef, useState } from 'react'
import { Map, SpeciesDistribution } from '../types'

interface Globe3DProps {
  distributions?: SpeciesDistribution[]
  showCurrents?: boolean
  showSpecies?: boolean
  onSpeciesClick?: (speciesId: string) => void
}

export default function Globe3D({
  distributions = [],
  showCurrents = true,
  showSpecies = true,
  onSpeciesClick,
}: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const initGlobe = async () => {
      try {
        // Dynamic import CesiumJS (heavy, only on client)
        const Cesium = (await import('cesium')).default
        await import('cesium/Build/Cesium/Widgets/widgets.css')

        if (cancelled || !containerRef.current) return

        // Token - for production, use your own ion token
        // Using Cesium's public token for demo
        Cesium.Ion.defaultAccessToken =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5N2UyMjcwOS00MDY1LTQxYjEtYjZjMy00YTU0ZGM5YWE1YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyMjY0NTE2M30.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk'

        const viewer = new Cesium.Viewer(containerRef.current, {
          terrainProvider: await Cesium.createWorldTerrainAsync(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: true,
          sceneModePicker: true,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          selectionIndicator: false,
          infoBox: false,
        })

        if (cancelled) {
          viewer.destroy()
          return
        }

        // Dark ocean base style
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0A1628')
        viewer.scene.skyAtmosphere.show = true
        viewer.scene.fog.enabled = true
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0A1628')

        // Enable globe rotation
        viewer.scene.screenSpaceCameraController.enableRotate = true
        viewer.scene.screenSpaceCameraController.enableZoom = true
        viewer.scene.screenSpaceCameraController.enableLook = true

        // Set initial camera position
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(120, 20, 20000000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        })

        viewerRef.current = viewer
        setLoading(false)

        // Add species distribution points
        if (showSpecies && distributions.length > 0) {
          addDistributionPoints(viewer, distributions, onSpeciesClick)
        }

        // Add ocean currents layer (simplified lines)
        if (showCurrents) {
          addOceanCurrents(viewer)
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Cesium init error:', err)
          setError(err.message || 'Failed to load 3D globe')
          setLoading(false)
        }
      }
    }

    initGlobe()

    return () => {
      cancelled = true
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [distributions, showCurrents, showSpecies])

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

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-deep-sea-900/90">
          <div className="text-center p-6">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-400 text-sm mb-2">地球加载失败</p>
            <p className="text-gray-500 text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Ocean selector controls */}
      <div className="absolute top-4 left-4 bg-deep-sea-800/90 backdrop-blur border border-deep-sea-600 rounded-lg p-3 space-y-2">
        <p className="text-xs text-gray-400 font-medium">🌊 快速跳转</p>
        {['太平洋', '大西洋', '印度洋'].map((ocean) => (
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

// Helper: fly camera to ocean region
function flyToOcean(ocean: string, viewer?: any) {
  if (!viewer) viewer = (window as any)._cesiumViewer
  if (!viewer) return

  const positions: Record<string, [number, number, number]> = {
    太平洋: [-160, 10, 25000000],
    大西洋: [-40, 20, 25000000],
    印度洋: [75, -10, 25000000],
  }

  const pos = positions[ocean]
  if (!pos) return

  const Cesium = (window as any).Cesium
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], pos[2]),
    duration: 2,
  })
}

// Add species distribution points as billboards
function addDistributionPoints(viewer: any, distributions: SpeciesDistribution[], onClick?: (id: string) => void) {
  const Cesium = (window as any).Cesium

  // Create entity collection for species points
  for (const dist of distributions) {
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(dist.longitude, dist.latitude),
      billboard: {
        image: createShrimpIcon(dist.is_verified),
        width: 24,
        height: 24,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      },
      properties: {
        speciesId: dist.species_id,
        locationName: dist.location_name,
      },
    })
  }
}

// Create a simple shrimp dot SVG data URL
function createShrimpIcon(verified: boolean): string {
  const color = verified ? '#00D4FF' : '#7B2FFF'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="${color}" opacity="0.8"/><circle cx="12" cy="12" r="4" fill="${color}"/></svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

// Add simplified ocean current lines
function addOceanCurrents(viewer: any) {
  const Cesium = (window as any).Cesium

  const currents = [
    // Kuroshio Current (Japan)
    { name: '黑潮', type: 'warm', coords: [[130, 25], [140, 30], [150, 35], [160, 40], [170, 45]] },
    // Gulf Stream
    { name: '湾流', type: 'warm', coords: [[-80, 25], [-70, 30], [-60, 40], [-50, 50], [-30, 55]] },
    // California Current
    { name: '加利福尼亚寒流', type: 'cold', coords: [[-120, 45], [-125, 40], [-130, 30], [-130, 20]] },
    // Peru Current
    { name: '秘鲁寒流', type: 'cold', coords: [[-80, -5], [-85, -10], [-90, -15], [-95, -20]] },
  ]

  for (const curr of currents) {
    const color = curr.type === 'warm'
      ? Cesium.Color.fromCssColorString('#FF4444').withAlpha(0.6)
      : Cesium.Color.fromCssColorString('#4488FF').withAlpha(0.6)

    viewer.entities.add({
      name: curr.name,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(
          curr.coords.flatMap((c) => [c[0], c[1], 0])
        ),
        width: 3,
        material: color,
        arcType: Cesium.ArcType.GREAT_CIRCLE,
      },
    })
  }
}
