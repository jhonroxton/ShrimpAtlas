// @ts-nocheck
/**
 * CesiumGlobe.tsx — 3D地球可视化组件
 * 技术栈: CesiumJS (地球渲染) + deck.gl (数据叠加层)
 * 功能: 物种分布点 / 热力图 / 洋流 / 迁移路径
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { ScatterplotLayer, ArcLayer, PathLayer } from '@deck.gl/layers'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { Deck } from '@deck.gl/core'
import type { SpeciesDistribution } from '../types/shrimp'

// ── Cesium Access Token (公开token，用于基础地图)
const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5N2UyMjcwOS00MDY1LTQxYjEtYjZjMy00YTZjYTA5YjBlMjQiLCJpZCI6NDk2Nywic2NvcGVzIjpbImFzciIsImdjIl0sImlhdCI6MTU0MjY0MzQ5NX0.aWBZpsBJ4Tm-fZom蒯I2UfPtS0xntCScj6iKSC5RDE'

// ── Props ───────────────────────────────────────────────────────────────────
export interface CesiumGlobeProps {
  distributions: SpeciesDistribution[]
  speciesImages: Record<string, string>
  species: any[]
  /** 当前是否显示热力图 */
  showHeatmap: boolean
  /** 当前是否显示洋流 */
  showCurrents: boolean
  /** 洄游路径是否显示 */
  showMigration: boolean
  /** 选中的物种详情回调 */
  onSpeciesClick?: (species: any, dist: SpeciesDistribution) => void
  /** 地球初始位置 [lon, lat] */
  initialLonLat?: [number, number]
}

// ── 常量 ───────────────────────────────────────────────────────────────────
const EARTH_R = 6371 // km

// ── 洋流数据 ────────────────────────────────────────────────────────────────
const OCEAN_CURRENTS = [
  { name: '黑潮',         type: 'warm', coords: [[120,25],[130,30],[145,35],[160,40],[180,43]] },
  { name: '湾流',          type: 'warm', coords: [[-80,25],[-70,30],[-60,40],[-40,50],[-20,58]] },
  { name: '加利福尼亚寒流', type: 'cold', coords: [[-115,45],[-125,38],[-130,25],[-135,15]] },
  { name: '秘鲁寒流',      type: 'cold', coords: [[-80,-5],[-85,-15],[-90,-25],[-95,-35]] },
  { name: '厄加勒斯暖流',  type: 'warm', coords: [[20,-30],[30,-35],[40,-40],[50,-42]] },
]

// ── 物种卡片HTML ────────────────────────────────────────────────────────────
function makeCardHTML(sp: any, imgUrl: string | null): string {
  const name = sp.cn_name || sp.en_name || sp.scientific_name || '—'
  const status = sp.iucn_status ? `[${sp.iucn_status}]` : ''
  const size = sp.max_length_cm ? `${sp.max_length_cm}cm` : ''
  const edible = sp.is_edible ? '✅ 可食用' : '⚠️ 不可食用'
  const img = imgUrl
    ? `<img src="${imgUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;font-size:2rem;\\'>🦐</div>'"/>`
    : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:2rem;">🦐</div>`

  return `
    <div style="
      background:rgba(5,15,35,0.92);
      border:1.5px solid rgba(0,212,255,0.4);
      border-radius:12px;
      padding:10px;
      width:80px;
      cursor:pointer;
      backdrop-filter:blur(12px);
      box-shadow:0 4px 20px rgba(0,0,0,0.6);
      transition:transform 0.2s,box-shadow 0.2s;
      font-family:'PingFang SC','Microsoft YaHei',sans-serif;
      overflow:hidden;
    " onmouseover="this.style.transform='scale(1.08)';this.style.boxShadow='0 6px 30px rgba(0,212,255,0.3)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 4px 20px rgba(0,0,0,0.6)'">
      <div style="width:60px;height:60px;margin:0 auto 6px;border-radius:8px;overflow:hidden;background:#0a1a2e;">
        ${img}
      </div>
      <div style="text-align:center;font-size:10px;color:#7ec8e3;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${name}
      </div>
      <div style="text-align:center;font-size:9px;color:#888;margin-top:2px;">${status} ${size}</div>
    </div>
  `
}

// ── CesiumGlobe 组件 ────────────────────────────────────────────────────────
export default function CesiumGlobe({
  distributions,
  speciesImages,
  species,
  showHeatmap,
  showCurrents,
  showMigration,
  onSpeciesClick,
  initialLonLat = [0, 20],
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const deckRef = useRef<any>(null)
  const pointsRef = useRef<any>(null)     // Cesium point primitives
  const currentsRef = useRef<any[]>([])    // Cesium entity refs for currents
  const labelsRef = useRef<any[]>([])      // Cesium label collections

  // ── 初始化 Cesium 地球 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    // 初始化 Cesium viewer
    const viewer = new Cesium.Viewer(containerRef.current, {
      imageryProvider: false,          // 不用地图瓦片，纯色地球
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      vrButton: false,
      infoBox: false,
      selectionIndicator: false,
      shadows: false,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
    })

    // 深海背景色
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0d1f3c')
    viewer.scene.globe.showGroundAtmosphere = false
    viewer.scene.fog.enabled = false
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#071020')

    // 初始相机位置
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(initialLonLat[0], initialLonLat[1], 8000000),
    })

    // 取消右键点击默认行为
    viewer.scene.screenSpaceCameraController.enableRotate = true
    viewer.scene.screenSpaceCameraController.enableZoom = true

    viewerRef.current = viewer

    // ── 初始化 deck.gl 叠加层 ─────────────────────────────────────────
    const deck = new Deck({
      parent: containerRef.current,
      style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
      viewState: {
        longitude: initialLonLat[0],
        latitude: initialLonLat[1],
        zoom: 2,
        pitch: 0,
        bearing: 0,
      },
      controller: false, // Cesium 控制交互，deck 只负责渲染
      layers: [],
      onClick: (info: any) => {
        if (info.object && onSpeciesClick) {
          const sp = info.object._species
          const dist = info.object._dist
          if (sp && dist) onSpeciesClick(sp, dist)
        }
      },
      getTooltip: ({ object }: any) => {
        if (!object || !object._species) return null
        const sp = object._species
        return {
          html: `<div style="background:rgba(5,15,35,0.95);border:1px solid rgba(0,212,255,0.4);border-radius:10px;padding:10px 14px;color:#e0f4ff;font-family:'PingFang SC',sans-serif;">
            <b style="font-size:14px;color:#7ec8e3">${sp.cn_name || sp.en_name || '—'}</b><br/>
            <span style="color:#aaa;font-size:11px">${sp.scientific_name || ''}</span>
          </div>`,
          style: { backgroundColor: 'transparent', border: 'none', boxShadow: 'none' },
        }
      },
    })
    deckRef.current = deck

    // 相机同步: Cesium camera → deck.gl viewState
    const onTick = () => {
      const cam = viewer.camera
      const pos = Cesium.Cartographic.fromCartesian(cam.position)
      const lon = Cesium.Math.toDegrees(pos.longitude)
      const lat = Cesium.Math.toDegrees(pos.latitude)
      const height = pos.height

      deck.setProps({
        viewState: {
          longitude: lon,
          latitude: lat,
          zoom: Math.log2(42135000 / height) - 1,
          pitch: Cesium.Math.toDegrees(cam.pitch),
          bearing: Cesium.Math.toDegrees(cam.heading),
        },
      })
    }
    viewer.scene.preRender.addEventListener(onTick)

    return () => {
      viewer.scene.preRender.removeEventListener(onTick)
      deck.finalize()
      viewer.destroy()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 更新分布点层 ─────────────────────────────────────────────────────────
  const buildDistributionLayer = useCallback(() => {
    if (!deckRef.current || distributions.length === 0) return

    const scatterLayer = new ScatterplotLayer({
      id: 'distribution-points',
      data: distributions,
      getPosition: (d: SpeciesDistribution) => [d.longitude, d.latitude, 0],
      getRadius: 18000,
      radiusMinPixels: 2,
      radiusMaxPixels: 8,
      getFillColor: [0, 200, 255, 180],
      pickable: true,
      opacity: 0.85,
      stroked: true,
      getLineColor: [0, 130, 200, 200],
      lineWidthMinPixels: 0.5,
      updateTriggers: {
        getPosition: distributions.length,
      },
    })

    deckRef.current.setProps({ layers: [scatterLayer] })
  }, [distributions])

  // ── 更新热力图层 ─────────────────────────────────────────────────────────
  const buildHeatmapLayer = useCallback(() => {
    if (!deckRef.current) return

    if (!showHeatmap) {
      buildDistributionLayer()
      return
    }

    // 从分布点聚合计算热力图权重
    const heatmapData = distributions.map((d: SpeciesDistribution) => ({
      position: [d.longitude, d.latitude],
      weight: 1,
    }))

    const heatLayer = new HeatmapLayer({
      id: 'heatmap',
      data: heatmapData,
      getPosition: (d: any) => d.position,
      getWeight: (d: any) => d.weight,
      radiusPixels: 60,
      intensity: 1.2,
      threshold: 0.05,
      colorRange: [
        [0, 0, 50, 0],
        [0, 100, 200, 80],
        [0, 180, 255, 140],
        [100, 255, 200, 190],
        [255, 255, 100, 230],
        [255, 100, 0, 255],
      ],
    })

    deckRef.current.setProps({ layers: [heatLayer] })
  }, [distributions, showHeatmap, buildDistributionLayer])

  // ── 更新洋流线 ───────────────────────────────────────────────────────────
  const buildCurrentsLayer = useCallback(() => {
    if (!deckRef.current) return

    const arcLayer = new ArcLayer({
      id: 'ocean-currents',
      data: OCEAN_CURRENTS,
      getSourcePosition: (d: any) => d.coords[0],
      getTargetPosition: (d: any) => d.coords[d.coords.length - 1],
      getHeight: 0.5,
      getTilt: 20,
      getSourceColor: (d: any) => d.type === 'warm' ? [255, 100, 50, 200] : [50, 150, 255, 200],
      getTargetColor: (d: any) => d.type === 'warm' ? [255, 50, 50, 100] : [0, 100, 200, 100],
      pickable: false,
      autoHighlight: false,
    })

    const existingLayers = deckRef.current.props.layers.filter((l: any) => l.id !== 'ocean-currents')
    deckRef.current.setProps({ layers: [...existingLayers, arcLayer] })
  }, [showCurrents])

  // ── 更新 deck.gl layers（统一入口）─────────────────────────────────────
  useEffect(() => {
    if (!deckRef.current || distributions.length === 0) return

    let layers: any[] = []

    if (showHeatmap) {
      const heatmapData = distributions.map((d: SpeciesDistribution) => ({
        position: [d.longitude, d.latitude],
        weight: 1,
      }))
      layers.push(new HeatmapLayer({
        id: 'heatmap',
        data: heatmapData,
        getPosition: (d: any) => d.position,
        getWeight: (d: any) => d.weight,
        radiusPixels: 50,
        intensity: 1,
        threshold: 0.03,
        colorRange: [
          [0, 0, 40, 0],
          [0, 80, 180, 100],
          [0, 160, 255, 160],
          [80, 255, 180, 210],
          [255, 255, 60, 240],
          [255, 80, 0, 255],
        ],
      }))
    } else {
      // 普通分布点
      layers.push(new ScatterplotLayer({
        id: 'distribution-points',
        data: distributions,
        getPosition: (d: SpeciesDistribution) => [d.longitude, d.latitude],
        getRadius: 22000,
        radiusMinPixels: 1.5,
        radiusMaxPixels: 7,
        getFillColor: [0, 210, 255, 190],
        pickable: true,
        opacity: 0.9,
        stroked: true,
        getLineColor: [0, 140, 220, 220],
        lineWidthMinPixels: 0.4,
      }))
    }

    // 洋流
    if (showCurrents) {
      layers.push(new PathLayer({
        id: 'ocean-currents',
        data: OCEAN_CURRENTS.map(c => ({
          ...c,
          path: c.coords,
        })),
        getPath: (d: any) => d.path,
        getColor: (d: any) => d.type === 'warm' ? [255, 110, 50, 220] : [50, 150, 255, 220],
        getWidth: 3,
        widthMinPixels: 1.5,
        capRounded: true,
        jointRounded: true,
        opacity: 0.75,
        pickable: false,
      }))
    }

    deckRef.current.setProps({ layers })
  }, [distributions, showHeatmap, showCurrents, showMigration])

  // ── 飞向指定位置 ────────────────────────────────────────────────────────
  const flyTo = useCallback((lon: number, lat: number, height = 200000) => {
    if (!viewerRef.current) return
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: 1.8,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    })
  }, [])

  // ── 暴露 flyTo 给父组件 ─────────────────────────────────────────────────
  // 通过 ref 回调暴露
  useEffect(() => {
    if ((window as any).__cesiumGlobeFlyTo === undefined) {
      (window as any).__cesiumGlobeFlyTo = flyTo
    }
  }, [flyTo])

  // ── 渲染 ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Cesium 容器 */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
