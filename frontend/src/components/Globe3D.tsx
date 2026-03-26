import { useEffect, useRef, useState, useCallback } from 'react'
import { SpeciesDistribution } from '../types'

// Cesium is always `any` here since we lazy-load it
type CesiumType = any

interface Globe3DProps {
  distributions?: SpeciesDistribution[]
  showCurrents?: boolean
  showSpecies?: boolean
  onSpeciesClick?: (speciesId: string) => void
  initialCenter?: { lon: number; lat: number; height?: number }
}

// Ocean region fly-to presets
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
  const viewerRef    = useRef<any>(null)
  const cesiumRef    = useRef<CesiumType>(null)
  const [loading, setLoading] = useState(true)
  const [error,  setError]  = useState<string | null>(null)

  // ── Fly camera to an ocean region ──────────────────────────────────────────
  const flyToOcean = useCallback((ocean: string) => {
    const pos  = OCEAN_PRESETS[ocean]
    const Ces  = cesiumRef.current
    const view = viewerRef.current
    if (!Ces || !view || !pos) return

    view.camera.flyTo({
      destination: Ces.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.height),
      duration: 2,
    })
  }, [])

  // ── Init Cesium ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const Ces = await import('cesium')
        if (cancelled) return
        cesiumRef.current = Ces.default

        // Inject Cesium base URL so Vite can resolve workers / imagery
        (window as any).CESIUM_BASE_URL = '/cesium'

        if (!containerRef.current) return

        const view = new Ces.default.Viewer(containerRef.current, {
          // imageryProvider built-in Bing is fine; terrain from ion
          terrainProvider: await Ces.default.createWorldTerrainAsync(),
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

        if (cancelled) {
          view.destroy()
          return
        }

        viewerRef.current = view

        // ── Dark-ocean theme ─────────────────────────────────────────────────
        view.scene.globe.baseColor = Ces.default.Color.fromCssColorString('#0A1628')
        view.scene.skyAtmosphere.show = true
        view.scene.fog.enabled = true
        view.scene.backgroundColor = Ces.default.Color.fromCssColorString('#070f1a')

        // Subtle globe translucency for depth feel
        view.scene.globe.enableLighting = false

        // Initial camera
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

        // Store Cesium on window for the outside flyToOcean helper
        ;(window as any).Cesium = Ces.default

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
  }, [])  // stable – re-init only once

  // ── Re-render layers when data changes ─────────────────────────────────────
  useEffect(() => {
    const view = viewerRef.current
    const Ces  = cesiumRef.current
    if (!view || !Ces) return

    // Remove old entity collections (keep base scene)
    view.entities.removeAll()

    if (showSpecies)  addDistributionPoints(view, Ces, distributions, onSpeciesClick)
    if (showCurrents) addOceanCurrents(view, Ces)
  }, [distributions, showCurrents, showSpecies, onSpeciesClick])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070f1a]/80 z-10">
          <div className="w-12 h-12 rounded-full border-2 border-ocean-accent border-t-transparent animate-spin mb-4" />
          <p className="text-ocean-accent text-sm font-medium tracking-wide">
            正在加载 3D 地球…
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070f1a]/90 z-10">
          <p className="text-red-400 text-sm mb-1">⚠ 地球加载失败</p>
          <p className="text-gray-500 text-xs max-w-xs text-center">{error}</p>
        </div>
      )}

      {/* Ocean quick-nav panel */}
      <div className="absolute top-4 left-4 z-20">
        <div className="bg-[#0d1f35]/90 backdrop-blur-sm border border-[#1e3a5f] rounded-xl px-3 py-2 space-y-1 shadow-xl">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
            🌊 快速跳转
          </p>
          {Object.keys(OCEAN_PRESETS).map((ocean) => (
            <button
              key={ocean}
              onClick={() => flyToOcean(ocean)}
              className="block w-full text-left text-xs text-gray-300 hover:text-ocean-accent transition-colors py-1 px-1 rounded hover:bg-white/5"
            >
              {ocean}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Layer helpers ─────────────────────────────────────────────────────────────

function addDistributionPoints(
  viewer: any,
  Ces: any,
  distributions: SpeciesDistribution[],
  onClick?: (id: string) => void,
) {
  for (const dist of distributions) {
    const color  = dist.is_verified ? '#00D4FF' : '#9b5de5'
    const imgData = makeShrimpIcon(color)

    const entity = viewer.entities.add({
      position: Ces.Cartesian3.fromDegrees(dist.longitude, dist.latitude),
      billboard: {
        image: imgData,
        width: 20,
        height: 20,
        verticalOrigin: Ces.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        speciesId:     dist.species_id,
        locationName:  dist.location_name ?? '',
        isVerified:     dist.is_verified,
      },
    })

    if (onClick) {
      entity.description = `<p class="cesium-info-box-content">${dist.location_name ?? ''}</p>`
      // Cesium's pick triggers on click
      ;(entity as any)._onClick = () => onClick(dist.species_id)
    }
  }
}

function addOceanCurrents(viewer: any, Ces: any) {
  // Curated subset of real NOAA current corridors
  const currents: Array<{
    name: string
    type: 'warm' | 'cold'
    coords: [number, number][]
  }> = [
    { name: '黑潮 (Kuroshio)',         type: 'warm', coords: [[130,25],[140,30],[150,35],[160,40],[170,45],[180,50]] },
    { name: '湾流 (Gulf Stream)',        type: 'warm', coords: [[-80,25],[-70,30],[-60,40],[-50,50],[-30,55],[0,60]] },
    { name: '北赤道流 (NE Pacific)',     type: 'warm', coords: [[-160,15],[-140,15],[-120,15],[-100,15]] },
    { name: '南赤道流 (SE Pacific)',     type: 'warm', coords: [[-160,-5],[-140,-5],[-120,-5],[-100,-5]] },
    { name: '墨西哥湾流延伸',            type: 'warm', coords: [[-80,30],[-75,35],[-70,40],[-60,45]] },
    { name: '加利福尼亚寒流',            type: 'cold', coords: [[-120,48],[-125,42],[-130,32],[-130,22],[-125,12]] },
    { name: '秘鲁寒流 (Humboldt)',       type: 'cold', coords: [[-80,-5],[-85,-10],[-90,-15],[-95,-20],[-100,-25]] },
    { name: '北大西洋流',               type: 'warm', coords: [[-30,55],[0,55],[20,60],[40,62]] },
    { name: '拉布拉多寒流',             type: 'cold', coords: [[-65,55],[-60,58],[-50,60],[-40,62]] },
    { name: '东澳大利亚流',             type: 'warm', coords: [[145,-25],[155,-30],[165,-35],[175,-40]] },
    { name: '马达加斯加寒流',           type: 'cold', coords: [[40,-15],[45,-20],[50,-25],[55,-30]] },
    { name: '莫桑比克流',               type: 'warm', coords: [[35,-10],[38,-15],[40,-20],[42,-25]] },
    { name: '阿古拉斯流',               type: 'warm', coords: [[28,-25],[32,-30],[35,-35],[38,-40]] },
    { name: '西澳大利亚流',             type: 'cold', coords: [[110,-25],[105,-30],[100,-35],[95,-38]] },
    { name: '厄加勒斯流',               type: 'warm', coords: [[28,-40],[25,-45],[20,-50],[15,-55]] },
    { name: '南极绕极流',               type: 'cold', coords: [
      [0,-55],[30,-55],[60,-58],[90,-60],[120,-58],[150,-55],[180,-55],
      [-150,-55],[-120,-58],[-90,-60],[-60,-58],[-30,-55],
    ]},
    { name: '巴西流',                   type: 'warm', coords: [[-40,-10],[-38,-20],[-35,-30],[-35,-40],[-38,-50]] },
    { name: '福克兰流',                 type: 'cold', coords: [[-55,-45],[-50,-50],[-45,-55],[-40,-58]] },
    { name: '勘察加流 (Oyashio)',       type: 'cold', coords: [[145,45],[155,48],[165,50],[175,52]] },
    { name: '北太平洋流',               type: 'warm', coords: [[140,45],[160,48],[180,48],[-160,48],[-140,45]] },
    { name: '南极绕极流·太平洋段',       type: 'cold', coords: [[180,-60],[-150,-60],[-120,-58],[-90,-60]] },
    { name: '季风流 (印度洋)',           type: 'warm', coords: [[50,10],[55,5],[60,0],[65,-5],[70,-10]] },
    { name: '索马里流',                 type: 'cold', coords: [[45,10],[50,8],[55,5],[60,2]] },
    { name: '北赤道流·大西洋',          type: 'warm', coords: [[-50,15],[-40,15],[-30,15],[-20,12]] },
    { name: '加那利流',                 type: 'cold', coords: [[-20,35],[-20,30],[-18,25],[-15,20]] },
    { name: '亚速尔流',                 type: 'warm', coords: [[-30,40],[-25,42],[-20,45],[-15,48]] },
    { name: '波弗特环流',               type: 'warm', coords: [[-140,72],[-130,73],[-120,72],[-130,70],[-140,70]] },
    { name: '穿极流',                   type: 'cold', coords: [[0,85],[30,85],[60,88],[90,85],[120,87],[150,85],[180,86]] },
    { name: '威德尔环流',               type: 'cold', coords: [[-50,-68],[-30,-72],[-10,-68],[10,-72],[30,-68],[50,-72],[-50,-68]] },
    { name: '罗斯环流',                 type: 'cold', coords: [[-180,-70],[-160,-75],[-140,-70],[-160,-65],[-180,-70]] },
  ]

  for (const curr of currents) {
    const rgba = curr.type === 'warm'
      ? [1.0, 0.35, 0.20, 0.55]   // warm – orange-red
      : [0.25, 0.55, 1.0, 0.55]   // cold – blue

    const flat = curr.coords.flatMap((c) => [c[0], c[1], 0])

    viewer.entities.add({
      name: curr.name,
      polyline: {
        positions: Ces.Cartesian3.fromDegreesArrayHeights(flat),
        width: 2.5,
        material: new Ces.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Ces.Color.fromBytes(
            rgba[0] * 255,
            rgba[1] * 255,
            rgba[2] * 255,
            rgba[3] * 255,
          ),
        }),
        arcType: Ces.ArcType.GREAT_CIRCLE,
        clampToGround: false,
      },
    })
  }
}

// Small SVG data-URL shrimp dot
function makeShrimpIcon(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="7" fill="${color}" opacity="0.25"/>
    <circle cx="10" cy="10" r="4" fill="${color}" opacity="0.85"/>
    <circle cx="10" cy="10" r="1.5" fill="white" opacity="0.9"/>
  </svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}
