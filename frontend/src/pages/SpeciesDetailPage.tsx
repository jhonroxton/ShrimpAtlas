import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { speciesApi } from '../api/species'
import { ShrimpSpecies, SpeciesDistribution } from '../types'

const IUCN_INFO: Record<string, { label: string; color: string; desc: string }> = {
  CR: { label: '极危', color: 'bg-red-900 text-red-300 border border-red-700', desc: '野外灭绝风险极高' },
  EN: { label: '濒危', color: 'bg-orange-900 text-orange-300 border border-orange-700', desc: '野外灭绝风险很高' },
  VU: { label: '易危', color: 'bg-yellow-900 text-yellow-300 border border-yellow-700', desc: '野外灭绝风险较高' },
  NT: { label: '近危', color: 'bg-blue-900 text-blue-300 border border-blue-700', desc: '存在灭绝风险' },
  LC: { label: '无危', color: 'bg-green-900 text-green-300 border border-green-700', desc: '暂无灭绝风险' },
  DD: { label: '数据缺乏', color: 'bg-gray-700 text-gray-300 border border-gray-600', desc: '数据不足，无法评估' },
}

const HABITAT_LABELS: Record<string, string> = {
  deep_sea: '🌊 深海',
  coastal: '🏖️ 近海',
  freshwater: '🏞️ 淡水',
  brackish: '�盐水 汽水',
}

export default function SpeciesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [species, setSpecies] = useState<ShrimpSpecies | null>(null)
  const [distributions, setDistributions] = useState<SpeciesDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeImg, setActiveImg] = useState(0)

  useEffect(() => {
    if (!id) return
    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const [sp, dists] = await Promise.all([
          speciesApi.getById(id),
          speciesApi.getDistributions(id),
        ])
        setSpecies(sp)
        setDistributions(dists)
      } catch (err: any) {
        setError(err.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-deep-sea-800 rounded" />
          <div className="h-64 bg-deep-sea-800 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-deep-sea-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !species) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
        <div className="text-4xl mb-4">🔍</div>
        <p className="text-red-400 mb-2">加载失败</p>
        <p className="text-gray-500 text-sm">{error || '未找到该物种'}</p>
        <Link to="/species" className="text-ocean-accent text-sm mt-4 inline-block hover:underline">
          ← 返回物种库
        </Link>
      </div>
    )
  }

  const iucn = IUCN_INFO[species.iucn_status] || IUCN_INFO.DD
  const habitat = HABITAT_LABELS[species.habitat || ''] || species.habitat || '未知'
  const images = species.images?.length ? species.images : []

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/" className="hover:text-ocean-accent transition-colors">首页</Link>
        <span>/</span>
        <Link to="/species" className="hover:text-ocean-accent transition-colors">物种库</Link>
        <span>/</span>
        <span className="text-gray-200">{species.cn_name || species.en_name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Images */}
        <div>
          {/* Main Image */}
          <div className="relative h-72 bg-deep-sea-800 rounded-xl overflow-hidden mb-3">
            {images.length > 0 ? (
              <>
                <img
                  src={images[activeImg]}
                  alt={species.cn_name}
                  className="w-full h-full object-cover"
                />
                {images.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImg(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${i === activeImg ? 'bg-ocean-accent' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-7xl">🦐</span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === activeImg ? 'border-ocean-accent' : 'border-transparent'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Distribution locations */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">📍 分布地点</h3>
            {distributions.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无分布数据</p>
            ) : (
              <div className="space-y-2">
                {distributions.slice(0, 10).map((d) => (
                  <div key={d.id} className="bg-deep-sea-800 rounded-lg px-3 py-2 text-sm flex justify-between items-center">
                    <span className="text-gray-300">{d.location_name}</span>
                    <div className="flex gap-3 text-xs text-gray-500">
                      {d.depth_m && <span>深度: {d.depth_m}m</span>}
                      {d.is_verified && <span className="text-ocean-accent">✓ 已验证</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Info */}
        <div>
          {/* Title */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-ocean-accent mb-1">
              {species.cn_name || species.en_name}
            </h1>
            <p className="text-lg text-gray-300 italic mb-1">{species.scientific_name}</p>
            <p className="text-gray-400">{species.en_name}</p>
          </div>

          {/* IUCN Status */}
          {species.iucn_status && (
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg mb-6 ${iucn.color}`}>
              <span className="font-bold">{species.iucn_status}</span>
              <span>{iucn.label}</span>
              <span className="text-xs opacity-70">— {iucn.desc}</span>
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {species.is_edible && (
              <span className="bg-ocean-accent/20 text-ocean-accent text-sm px-3 py-1 rounded-full border border-ocean-accent/40">
                🍽️ 可食用
              </span>
            )}
            {habitat && (
              <span className="bg-deep-sea-700 text-gray-300 text-sm px-3 py-1 rounded-full">
                {habitat}
              </span>
            )}
            {species.family && (
              <span className="bg-deep-sea-700 text-gray-300 text-sm px-3 py-1 rounded-full">
                🧬 {species.family}
              </span>
            )}
            {species.genus && (
              <span className="bg-deep-sea-700 text-gray-300 text-sm px-3 py-1 rounded-full">
                {species.genus}
              </span>
            )}
          </div>

          {/* Details Grid */}
          <div className="space-y-3 mb-6">
            {[
              ['🔬 拉丁学名', species.scientific_name],
              ['📏 最大体长', species.max_length_cm ? `${species.max_length_cm} cm` : '未知'],
              ['🎨 颜色特征', species.color_description || '未知'],
              ['🌡️ 温度带', species.temperature_zone || '未知'],
              ['🍖 食性', species.diet || '未知'],
              ['🐟 捕捞方式', species.fishing_type === 'wild' ? '野生' : species.fishing_type === 'farmed' ? '养殖' : species.fishing_type ? '野生/养殖' : '未知'],
              ...(species.edible_regions?.length ? [['🍽️ 食用地区', species.edible_regions.join('、')]] : []),
            ].map(([label, value]) => (
              <div key={label as string} className="flex gap-3 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0">{label}</span>
                <span className="text-gray-200">{value}</span>
              </div>
            ))}
          </div>

          {/* Threats */}
          {species.threats?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">⚠️ 主要威胁因素</h3>
              <div className="flex flex-wrap gap-2">
                {species.threats.map((t) => (
                  <span key={t} className="text-xs bg-red-900/40 text-red-300 border border-red-800 px-2 py-1 rounded">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Data source */}
          <div className="text-xs text-gray-500 border-t border-deep-sea-600 pt-4">
            <p>数据来源：WoRMS · IUCN Red List</p>
          </div>
        </div>
      </div>
    </div>
  )
}
