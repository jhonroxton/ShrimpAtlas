// @ts-nocheck
/**
 * CesiumGlobe.tsx — CesiumJS 3D地球 + deck.gl 数据叠加层
 * 修复：强制 3D 模式、纯色地球、deck.gl 分布点/热力图/洋流
 */

import { useEffect, useRef, useCallback } from 'react'
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { Deck } from '@deck.gl/core'
import type { SpeciesDistribution } from '../types/shrimp'

export interface CesiumGlobeProps {
  distributions: SpeciesDistribution[]
  speciesImages: Record<string, string>
  species: any[]
  showHeatmap: boolean
  showCurrents: boolean
  showMigration: boolean
  onSpeciesClick?: (species: any, dist: SpeciesDistribution) => void
  initialLonLat?: [number, number]
}

const OCEAN_CURRENTS = [
  { name: '黑潮',         type: 'warm', path: [[120,25],[130,30],[145,35],[160,40],[180,43]] },
  { name: '湾流',          type: 'warm', path: [[-80,25],[-70,30],[-60,40],[-40,50],[-20,58]] },
  { name: '加利福尼亚寒流', type: 'cold', path: [[-115,45],[-125,38],[-130,25],[-135,15]] },
  { name: '秘鲁寒流',      type: 'cold', path: [[-80,-5],[-85,-15],[-90,-25],[-95,-35]] },
  { name: '厄加勒斯暖流',  type: 'warm', path: [[20,-30],[30,-35],[40,-40],[50,-42]] },
]

export default function CesiumGlobe({
  distributions,
  showHeatmap,
  showCurrents,
  showMigration,
  onSpeciesClick,
  initialLonLat = [0, 20],
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const deckRef = useRef<any>(null)
  const deckContainerRef = useRef<HTMLDivElement>(null)

  // ── 初始化 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    // 动态导入 Cesium（避免 SSR 问题）
    import('cesium').then((CesiumModule) => {
      const Cesium = CesiumModule

      // ── Cesium 地球 ────────────────────────────────────────────────────
      const viewer = new Cesium.Viewer(containerRef.current, {
        // 禁用所有在线地图瓦片（无外网依赖）
        imageryProvider: false,
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
        // 大气渲染（蓝绿色地球光晕）
        skyAtmosphere: new Cesium.SkyAtmosphere(),
        skyBox: new Cesium.SkyBox(false),
        // 关闭所有大气效果，提升性能
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
      })

      // ── 强制 3D 模式 ────────────────────────────────────────────────────
      // Cesium 默认有时会使用 Columbus View，强制切换为真 3D
      if (viewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
        viewer.scene.mode = Cesium.SceneMode.SCENE3D
      }

      // ── 地球外观 ──────────────────────────────────────────────────────
      // 深海蓝色
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0d3a5c')
      // 去掉地表大气（避免白色光晕）
      viewer.scene.globe.showGroundAtmosphere = false
      // 关闭雾效
      viewer.scene.fog.enabled = false
      // 太空背景
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020a14')

      // ── 初始相机位置 ───────────────────────────────────────────────────
      // 从侧面看地球，有一定倾斜角度，3D 效果明显
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          initialLonLat[0],
          initialLonLat[1],
          12000000 // 12000km 高度
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-30), // 俯视30度
          roll: 0,
        },
      })

      viewerRef.current = viewer

      // ── deck.gl 叠加层（覆盖在 Cesium 画布上） ──────────────────────
      const deckContainer = document.createElement('div')
      deckContainer.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none; z-index: 10;
      `
      containerRef.current.appendChild(deckContainer)
      deckContainerRef.current = deckContainer

      const deck = new Deck({
        parent: deckContainer,
        viewState: getViewState(viewer),
        controller: false, // Cesium 控制交互
        layers: buildLayers(distributions, showHeatmap, showCurrents, showMigration),
        onClick: (info: any) => {
          if (info.object && onSpeciesClick) {
            const sp = info.object._species
            const dist = info.object._dist
            if (sp && dist) onSpeciesClick(sp, dist)
          }
        },
        getTooltip: ({ object }: any) => {
          if (!object?._species) return null
          const sp = object._species
          return {
            html: `<div style="background:rgba(5,15,35,0.95);border:1px solid rgba(0,212,255,0.4);border-radius:10px;padding:10px 14px;color:#e0f4ff;font-family:sans-serif;">
              <b style="font-size:14px;color:#7ec8e3">${sp.cn_name || sp.en_name || '—'}</b><br/>
              <span style="color:#aaa;font-size:11px">${sp.scientific_name || ''}</span>
            </div>`,
            style: { backgroundColor: 'transparent', border: 'none', boxShadow: 'none' },
          }
        },
      })
      deckRef.current = deck

      // ── 相机同步：Cesium → deck.gl ───────────────────────────────────
      const onTick = () => {
        if (!viewerRef.current || !deckRef.current) return
        try {
          deckRef.current.setProps({ viewState: getViewState(viewerRef.current) })
        } catch (_) {}
      }
      viewer.scene.preRender.addEventListener(onTick)

      // ── 暴露 flyTo ────────────────────────────────────────────────────
      ;(window as any).__cesiumGlobeFlyTo = (lon: number, lat: number, height = 800000) => {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
          duration: 1.8,
        })
      }

      return () => {
        viewer.scene.preRender.removeEventListener(onTick)
        try { deck.finalize() } catch (_) {}
        try { viewer.destroy() } catch (_) {}
        ;(window as any).__cesiumGlobeFlyTo = undefined
      }
    }).catch((err) => {
      console.error('Cesium 加载失败:', err)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 从 Cesium 相机获取 deck.gl viewState ──────────────────────────────
  function getViewState(viewer: any) {
    const cam = viewer.camera
    const pos = Cesium.Cartographic.fromCartesian(cam.position)
    const lon = Cesium.Math.toDegrees(pos.longitude)
    const lat = Cesium.Math.toDegrees(pos.latitude)
    const height = pos.height
    const zoom = Math.log2(42135000 / height) - 1
    return {
      longitude: lon,
      latitude: lat,
      zoom: Math.max(0, zoom),
      pitch: Cesium.Math.toDegrees(cam.pitch),
      bearing: Cesium.Math.toDegrees(cam.heading),
    }
  }

  // ── 构建 deck.gl layers ───────────────────────────────────────────────
  function buildLayers(dists: SpeciesDistribution[], heatmap: boolean, currents: boolean, migration: boolean) {
    const layers: any[] = []

    if (heatmap) {
      layers.push(new HeatmapLayer({
        id: 'heatmap',
        data: dists,
        getPosition: (d: SpeciesDistribution) => [d.longitude, d.latitude],
        getWeight: () => 1,
        radiusPixels: 50,
        intensity: 1.2,
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
      // 分布点
      layers.push(new ScatterplotLayer({
        id: 'distribution-points',
        data: dists,
        getPosition: (d: SpeciesDistribution) => [d.longitude, d.latitude],
        getRadius: 80000,
        radiusMinPixels: 2,
        radiusMaxPixels: 10,
        getFillColor: [0, 210, 255, 200],
        pickable: true,
        opacity: 0.9,
        stroked: true,
        getLineColor: [0, 140, 220, 220],
        lineWidthMinPixels: 0.5,
        updateTriggers: { getPosition: dists.length },
      }))
    }

    // 洋流
    if (currents) {
      layers.push(new PathLayer({
        id: 'ocean-currents',
        data: OCEAN_CURRENTS,
        getPath: (d: any) => d.path,
        getColor: (d: any) => d.type === 'warm' ? [255, 110, 50, 200] : [50, 150, 255, 200],
        getWidth: 3,
        widthMinPixels: 1.5,
        capRounded: true,
        jointRounded: true,
        opacity: 0.75,
        pickable: false,
      }))
    }

    return layers
  }

  // ── 更新 layers（props 变化时）────────────────────────────────────────
  useEffect(() => {
    if (!deckRef.current || distributions.length === 0) return
    deckRef.current.setProps({ layers: buildLayers(distributions, showHeatmap, showCurrents, showMigration) })
  }, [distributions, showHeatmap, showCurrents, showMigration])

  // ── 渲染 ──────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    />
  )
}
