import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Globe3D from '../components/Globe3D'
import { mapApi } from '../api/map'
import { SpeciesDistribution } from '../types'

export default function HomePage() {
  const navigate = useNavigate()
  const [distributions, setDistributions] = useState<SpeciesDistribution[]>([])
  const [showCurrents, setShowCurrents] = useState(true)
  const [showSpecies, setShowSpecies] = useState(true)
  const [loading, setLoading] = useState(false)

  // Load map distributions from API
  useEffect(() => {
    const loadDistributions = async () => {
      setLoading(true)
      try {
        const geojson = await mapApi.getDistributions()
        // Convert GeoJSON to SpeciesDistribution format
        const dists: SpeciesDistribution[] = (geojson.features || []).map((f: any) => ({
          id: f.properties?.id || '',
          species_id: f.properties?.species_id || '',
          latitude: f.geometry?.coordinates?.[1] || 0,
          longitude: f.geometry?.coordinates?.[0] || 0,
          location_name: f.properties?.location_name || '',
          depth_m: f.properties?.depth_m,
          is_verified: f.properties?.is_verified || false,
          source: f.properties?.source || '',
        }))
        setDistributions(dists)
      } catch (err) {
        // Backend not ready yet - that's ok, globe still works
        console.warn('Could not load distributions:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDistributions()
  }, [])

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {/* 3D Globe */}
      <Globe3D
        distributions={distributions}
        showCurrents={showCurrents}
        showSpecies={showSpecies}
        onSpeciesClick={(id) => navigate(`/species/${id}`)}
      />

      {/* Floating control panel */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-deep-sea-800/95 backdrop-blur border border-deep-sea-600 rounded-xl px-6 py-4 flex gap-6 shadow-2xl">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showCurrents}
            onChange={(e) => setShowCurrents(e.target.checked)}
            className="accent-ocean-accent w-4 h-4"
          />
          <span className="text-sm text-gray-300">🌊 洋流</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showSpecies}
            onChange={(e) => setShowSpecies(e.target.checked)}
            className="accent-ocean-accent w-4 h-4"
          />
          <span className="text-sm text-gray-300">🦐 物种分布</span>
        </label>
        <div className="w-px bg-deep-sea-600" />
        <button
          onClick={() => navigate('/species')}
          className="text-sm text-ocean-accent hover:text-ocean-cyan transition-colors font-medium"
        >
          查看全部物种 →
        </button>
      </div>

      {/* Search bar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
        <SearchBar />
      </div>

      {/* Stats overlay */}
      <div className="absolute top-6 right-6 bg-deep-sea-800/90 backdrop-blur border border-deep-sea-600 rounded-xl px-4 py-3">
        <div className="text-xs text-gray-400 mb-1">🦐 已收录物种</div>
        <div className="text-2xl font-bold text-ocean-accent">38</div>
        <div className="text-xs text-gray-400 mt-2 mb-1">🌊 洋流数据</div>
        <div className="text-2xl font-bold text-blue-400">31</div>
      </div>
    </div>
  )
}

// Search bar component
function SearchBar() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSearch} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索虾类名称、学名..."
        className="w-full bg-deep-sea-800/95 backdrop-blur border border-deep-sea-600 text-gray-200 text-sm rounded-full px-5 py-3 pl-12 focus:border-ocean-accent focus:outline-none shadow-xl"
      />
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
      <button
        type="submit"
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-ocean-accent hover:bg-ocean-cyan text-deep-sea-900 text-xs font-bold px-4 py-1.5 rounded-full transition-colors"
      >
        搜索
      </button>
    </form>
  )
}
