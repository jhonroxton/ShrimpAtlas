// @ts-nocheck
/**
 * HomePage.tsx — 首页，整合 Three.js Globe3D + Sidebar + TimeSlider
 */

import { useState, useEffect, useCallback } from 'react'
import Globe3D from '../components/Globe3D'
import Sidebar, { FilterState, DEFAULT_FILTERS, applyFilters } from '../components/Sidebar'
import TimeSlider, { TimeState } from '../components/TimeSlider'
import { speciesApi } from '../api/species'
import type { SpeciesDistribution } from '../types/shrimp'

export default function HomePage() {
  const [distributions, setDistributions] = useState<SpeciesDistribution[]>([])
  const [speciesImages, setSpeciesImages] = useState<Record<string, string>>({})
  const [allSpecies, setAllSpecies] = useState<any[]>([])
  const [filteredSpecies, setFilteredSpecies] = useState<any[]>([])
  const [filteredDists, setFilteredDists] = useState<SpeciesDistribution[]>([])
  const [loading, setLoading] = useState(true)

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

  // ── 筛选变化 → 更新过滤后的分布点，Globe3D 自动重建卡片 ─────────────────
  const handleFilterChange = useCallback((filtered: any[], filters: FilterState) => {
    setFilteredSpecies(filtered)
    // 根据过滤后的物种ID筛选分布点
    const ids = new Set(filtered.map((s: any) => s.id))
    const fDists = distributions.filter(d => ids.has(d.species_id))
    setFilteredDists(fDists)
  }, [distributions])

  // ── 时间维度变化 ─────────────────────────────────────────────────────────
  const handleTimeChange = useCallback((time: TimeState) => {
    console.log('时间维度变化:', time)
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

      {/* Three.js 地球 */}
      <div style={{ marginLeft: '260px', height: '100%', position: 'relative' }}>
        <Globe3D
          distributions={filteredDists.length > 0 ? filteredDists : distributions}
          speciesImages={speciesImages}
          species={filteredSpecies.length > 0 ? filteredSpecies : allSpecies}
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

        {/* 物种数量统计 */}
        <div style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'rgba(4,12,28,0.8)', border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: '10px', padding: '6px 14px',
          backdropFilter: 'blur(10px)', zIndex: 50,
          fontSize: '12px', color: '#7ec8e3', textAlign: 'center',
        }}>
          🦐 <span style={{ color: '#0fdfff', fontWeight: 700 }}>
            {filteredDists.length > 0 ? filteredDists.length.toLocaleString() : distributions.length.toLocaleString()}
          </span> 个分布点 /{' '}
          <span style={{ color: '#0fdfff', fontWeight: 700 }}>
            {filteredSpecies.length > 0 ? filteredSpecies.length.toLocaleString() : allSpecies.length.toLocaleString()}
          </span> 种
        </div>

        {/* 时间维度滑块 */}
        <TimeSlider onChange={handleTimeChange} />
      </div>
    </div>
  )
}

