import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import SpeciesCard from '../components/SpeciesCard'
import { speciesApi, getWormsSpecies, mapWormsToShrimp } from '../api/species'
import { ShrimpSpecies } from '../types'

const HABITATS = [
  { value: '', label: '全部环境' },
  { value: 'deep_sea', label: '🌊 深海' },
  { value: 'coastal', label: '🏖️ 近海' },
  { value: 'freshwater', label: '🏞️ 淡水' },
  { value: 'brackish', label: '�盐水 汽水' },
]

const TEMP_ZONES = [
  { value: '', label: '全部温度带' },
  { value: 'tropical', label: '🌴 热带' },
  { value: 'temperate', label: '🍂 温带' },
  { value: 'cold', label: '❄️ 寒带' },
]

const IUCN_STATUSES = [
  { value: '', label: '全部保护等级' },
  { value: 'CR', label: '🔴 CR 极危' },
  { value: 'EN', label: '🟠 EN 濒危' },
  { value: 'VU', label: '🟡 VU 易危' },
  { value: 'NT', label: '🔵 NT 近危' },
  { value: 'LC', label: '🟢 LC 无危' },
]

const EDIBLE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'true', label: '🍽️ 可食用' },
  { value: 'false', label: '⚠️ 不可食用' },
]

export default function SpeciesListPage() {
  const navigate = useNavigate()
  const [species, setSpecies] = useState<ShrimpSpecies[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  // Filters
  const [habitat, setHabitat] = useState('')
  const [tempZone, setTempZone] = useState('')
  const [iucnStatus, setIucnStatus] = useState('')
  const [edible, setEdible] = useState('')
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const pageSize = 20

  const fetchSpecies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = { page, page_size: pageSize }
      if (habitat) params.habitat = habitat
      if (tempZone) params.temperature_zone = tempZone
      if (iucnStatus) params.iucn_status = iucnStatus
      if (edible !== '') params.is_edible = edible === 'true'

      const res = await speciesApi.list(params)
      setSpecies(res.data || [])
      setTotal(res.total || 0)
    } catch (err: any) {
      // Fall back to WoRMS data if FastAPI/backend is not available
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network') || err.response?.status === 404) {
        try {
          const worms = await getWormsSpecies()
          const mapped = worms.map(mapWormsToShrimp)
          setSpecies(mapped)
          setTotal(mapped.length)
          setError(null)
        } catch {
          setError('后端服务未启动，请先启动 FastAPI 后端 (cd backend && uvicorn app.main:app --reload)')
        }
      } else {
        setError(err.message || '加载失败')
      }
    } finally {
      setLoading(false)
    }
  }, [habitat, tempZone, iucnStatus, edible, page])

  useEffect(() => {
    fetchSpecies()
  }, [fetchSpecies])

  const handleViewOnMap = (speciesId: string) => {
    navigate(`/?focus=${speciesId}`)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ocean-accent mb-1">🦐 虾类物种库</h1>
        <p className="text-gray-400 text-sm">
          共 {total} 种虾类，已加载 {species.length} 条
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-deep-sea-800 border border-deep-sea-600 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Habitat */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">栖息环境</label>
            <select
              value={habitat}
              onChange={(e) => { setHabitat(e.target.value); setPage(1); setPageInput("1") }}
              className="w-full bg-deep-sea-700 border border-deep-sea-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:border-ocean-accent focus:outline-none"
            >
              {HABITATS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Temperature Zone */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">温度带</label>
            <select
              value={tempZone}
              onChange={(e) => { setTempZone(e.target.value); setPage(1); setPageInput("1") }}
              className="w-full bg-deep-sea-700 border border-deep-sea-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:border-ocean-accent focus:outline-none"
            >
              {TEMP_ZONES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* IUCN Status */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">保护等级</label>
            <select
              value={iucnStatus}
              onChange={(e) => { setIucnStatus(e.target.value); setPage(1); setPageInput("1") }}
              className="w-full bg-deep-sea-700 border border-deep-sea-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:border-ocean-accent focus:outline-none"
            >
              {IUCN_STATUSES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Edible */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">食用性</label>
            <select
              value={edible}
              onChange={(e) => { setEdible(e.target.value); setPage(1); setPageInput("1") }}
              className="w-full bg-deep-sea-700 border border-deep-sea-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:border-ocean-accent focus:outline-none"
            >
              {EDIBLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={() => { setHabitat(''); setTempZone(''); setIucnStatus(''); setEdible(''); setPage(1); setPageInput('1') }}
          className="mt-3 text-xs text-gray-400 hover:text-ocean-accent transition-colors"
        >
          重置筛选
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-deep-sea-800 rounded-xl h-80 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-red-400 mb-2">数据加载失败</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      ) : species.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🦐</div>
          <p className="text-gray-400">没有找到符合条件的虾类</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {species.map((sp) => (
              <SpeciesCard
                key={sp.id}
                species={sp}
                onViewOnMap={handleViewOnMap}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                disabled={page <= 1}
                onClick={() => { setPage((p) => Math.max(1, p - 1)); setPageInput(String(Math.max(1, page - 1))) }}
                className="px-4 py-2 bg-deep-sea-800 border border-deep-sea-600 rounded-lg text-sm text-gray-300 hover:text-ocean-accent disabled:opacity-40 transition-colors"
              >
                上一页
              </button>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { const p = Math.min(totalPages, Math.max(1, parseInt(pageInput) || 1)); setPage(p); setPageInput(String(p)) } }}
                  className="w-16 px-2 py-1.5 text-center bg-deep-sea-800 border border-deep-sea-600 rounded-lg text-sm text-gray-200 outline-none focus:border-cyan-400 transition-colors"
                />
                <button
                  onClick={() => { const p = Math.min(totalPages, Math.max(1, parseInt(pageInput) || 1)); setPage(p); setPageInput(String(p)) }}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 border border-cyan-500 rounded-lg text-sm text-white transition-colors"
                >
                  跳转
                </button>
                <span className="text-sm text-gray-400 ml-1">/ {totalPages} 页</span>
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => { setPage((p) => p + 1); setPageInput(String(page + 1)) }}
                className="px-4 py-2 bg-deep-sea-800 border border-deep-sea-600 rounded-lg text-sm text-gray-300 hover:text-ocean-accent disabled:opacity-40 transition-colors"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
