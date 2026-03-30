// @ts-nocheck
/**
 * HomePage.tsx — 首页，整合 CesiumGlobe + Sidebar + TimeSlider + DetailCard
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import CesiumGlobe from '../components/CesiumGlobe'
import Sidebar, { FilterState, DEFAULT_FILTERS, applyFilters } from '../components/Sidebar'
import TimeSlider, { TimeState } from '../components/TimeSlider'
import DetailCard from '../components/DetailCard'
import { speciesApi } from '../api/species'
import type { SpeciesDistribution } from '../types/shrimp'

export default function HomePage() {
  const [distributions, setDistributions] = useState<SpeciesDistribution[]>([])
  const [speciesImages, setSpeciesImages] = useState<Record<string, string>>({})
  const [allSpecies, setAllSpecies] = useState<any[]>([])
  const [filteredSpecies, setFilteredSpecies] = useState<any[]>([])
  const [filteredDists, setFilteredDists] = useState<SpeciesDistribution[]>([])
  const [loading, setLoading] = useState(true)

  // 地球图层可见性
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showCurrents, setShowCurrents] = useState(true)
  const [showMigration, setShowMigration] = useState(false)

  // 物种详情卡
  const [detailCard, setDetailCard] = useState<any>(null)
  const [detailVisible, setDetailVisible] = useState(false)

  // ── 加载数据 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // 加载所有物种
        const speciesList: any[] = []
        let page = 1
        while (true) {
          const res = await speciesApi.list({ page, page_size: 100 })
          if (!res.data?.length) break
          speciesList.push(...res.data)
          if (res.data.length < 100) break
          page++
          if (page > 30) break
        }
        setAllSpecies(speciesList)
        setFilteredSpecies(speciesList)

        // 构建图片映射
        const imgMap: Record<string, string> = {}
        for (const s of speciesList) {
          if (s.id && Array.isArray(s.images) && s.images[0]) {
            imgMap[s.id] = s.images[0]
          }
        }
        setSpeciesImages(imgMap)

        // 加载分布点（直接从后端 API 获取 GeoJSON）
        try {
          const resp = await fetch('/api/v1/map/distributions')
          const geojson = await resp.json()
          if (geojson?.features) {
            const dists: SpeciesDistribution[] = geojson.features.map((f: any) => ({
              id: f.properties?.id || '',
              species_id: f.properties?.species_id || '',
              latitude: f.geometry?.coordinates?.[1] || 0,
              longitude: f.geometry?.coordinates?.[0] || 0,
              location_name: f.properties?.location_name || '',
              depth_m: f.properties?.depth_m,
              is_verified: f.properties?.is_verified ?? false,
              source: f.properties?.source || '',
            }))
            setDistributions(dists)
          }
        } catch (e) {
          console.warn('分布点加载失败:', e)
        }
      } catch (err) {
        console.warn('加载失败:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── 筛选变化时，更新过滤后的分布点 ────────────────────────────────────
  const handleFilterChange = useCallback((filtered: any[], filters: FilterState) => {
    setFilteredSpecies(filtered)
    // 根据过滤后的物种ID列表，筛选分布点
    const ids = new Set(filtered.map((s: any) => s.id))
    const filteredDists = distributions.filter(d => ids.has(d.species_id))
    setFilteredDists(filteredDists)
  }, [distributions])

  // ── 时间维度变化 ─────────────────────────────────────────────────────────
  const handleTimeChange = useCallback((time: TimeState) => {
    // TODO: 根据季节/月过滤分布点数据（需要后端支持 season/month 字段）
    // 当前: 静默忽略，后续接入后端时实现
    console.log('时间维度变化:', time)
  }, [])

  // ── 物种点击 → 显示详情卡 ──────────────────────────────────────────────
  const handleSpeciesClick = useCallback((species: any, dist: SpeciesDistribution) => {
    setDetailCard(species)
    setDetailVisible(true)
    // 飞向该位置
    const flyTo = (window as any).__cesiumGlobeFlyTo
    if (flyTo && dist.longitude && dist.latitude) {
      flyTo(dist.longitude, dist.latitude, 500000)
    }
  }, [])

  const dismissDetail = useCallback(() => {
    setDetailVisible(false)
  }, [])

  // ── 渲染 ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden">

      {/* 侧边栏 */}
      <Sidebar
        species={allSpecies}
        totalDistCount={distributions.length}
        onFilterChange={handleFilterChange}
      />

      {/* Cesium 地球 */}
      <div style={{ marginLeft: '260px', height: '100%', position: 'relative' }}>
        <CesiumGlobe
          distributions={filteredDists.length > 0 ? filteredDists : distributions}
          speciesImages={speciesImages}
          species={filteredSpecies.length > 0 ? filteredSpecies : allSpecies}
          showHeatmap={showHeatmap}
          showCurrents={showCurrents}
          showMigration={showMigration}
          onSpeciesClick={handleSpeciesClick}
        />

        {/* 加载中 */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(7,16,32,0.7)', zIndex: 200,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🦐</div>
              <div style={{ color: '#7ec8e3', fontSize: '14px' }}>正在加载地球数据...</div>
            </div>
          </div>
        )}

        {/* 地球右上角：视图切换控制 */}
        <div style={{
          position: 'absolute', top: '16px', right: '16px', zIndex: 50,
          display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          {/* 热力图切换 */}
          <ToggleButton
            active={showHeatmap}
            onClick={() => setShowHeatmap(v => !v)}
            icon="🔥"
            label="热力图"
            color="#ff8800"
          />
          {/* 洋流切换 */}
          <ToggleButton
            active={showCurrents}
            onClick={() => setShowCurrents(v => !v)}
            icon="🌊"
            label="海洋洋流"
            color="#0fdfff"
          />
          {/* 洄游路径 */}
          <ToggleButton
            active={showMigration}
            onClick={() => setShowMigration(v => !v)}
            icon="🔄"
            label="洄游路径"
            color="#44cc88"
          />
        </div>

        {/* 物种数量统计 */}
        <div style={{
          position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(4,12,28,0.8)', border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: '10px', padding: '6px 16px',
          backdropFilter: 'blur(10px)', zIndex: 50,
          fontSize: '12px', color: '#7ec8e3', textAlign: 'center',
        }}>
          🦐 显示 <span style={{ color: '#0fdfff', fontWeight: 700 }}>
            {filteredDists.length > 0 ? filteredDists.length.toLocaleString() : distributions.length.toLocaleString()}
          </span> 个分布点 /{' '}
          <span style={{ color: '#0fdfff', fontWeight: 700 }}>
            {filteredSpecies.length > 0 ? filteredSpecies.length.toLocaleString() : allSpecies.length.toLocaleString()}
          </span> 种物种
        </div>

        {/* 时间维度滑块 */}
        <TimeSlider onChange={handleTimeChange} />

        {/* 详情卡 */}
        {detailCard && (
          <div style={{
            position: 'absolute', top: '50%', right: '20px', transform: 'translateY(-50%)',
            transition: 'opacity 0.4s, transform 0.4s',
            opacity: detailVisible ? 1 : 0,
            pointerEvents: detailVisible ? 'auto' : 'none',
            zIndex: 150,
          }}>
            <DetailCard data={detailCard} onClose={dismissDetail} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── 小组件 ──────────────────────────────────────────────────────────────────
function ToggleButton({ active, onClick, icon, label, color }: {
  active: boolean; onClick: () => void; icon: string; label: string; color: string
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 12px',
        background: active
          ? `rgba(${hexToRgb(color)},0.2)`
          : 'rgba(4,12,28,0.8)',
        border: `1.5px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '8px',
        color: active ? color : '#aaa',
        cursor: 'pointer', fontSize: '12px',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.2s',
        boxShadow: active && hover ? `0 0 16px ${color}44` : 'none',
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
    : '0,212,255'
}
