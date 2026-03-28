import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Globe3D from '../components/Globe3Dv2'
import { mapApi } from '../api/map'
import { speciesApi } from '../api/species'
import { SpeciesDistribution } from '../types'

export default function HomePage() {
  const [distributions, setDistributions] = useState<SpeciesDistribution[]>([])
  const [speciesImages, setSpeciesImages] = useState<Record<string, string>>({})
  const [species, setSpecies] = useState<any[]>([])
  const [, setLoading] = useState(false)

  // Load distributions + species name→ID mapping → speciesImages
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      try {
        // Load distributions
        const geojson = await mapApi.getDistributions()
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

        // Build species → image URL map from local cached images
        // Folder structure: /species-images/{Genus_species}/1.jpg
        // Load all species pages (260 total, 100 per page)
        const allSpecies: any[] = []
        let page = 1
        while (true) {
          const res = await speciesApi.list({ page, page_size: 100 })
          if (!res.data?.length) break
          allSpecies.push(...res.data)
          if (res.data.length < 100) break
          page++
          if (page > 5) break  // safety cap
        }

        // Build species → image URL map directly from API's images field
        const imgMap: Record<string, string> = {}
        for (const s of allSpecies) {
          if (s.id && Array.isArray(s.images) && s.images[0]) {
            imgMap[s.id] = s.images[0]
          }
        }
        setSpeciesImages(imgMap)
        setSpecies(allSpecies)
      } catch (err) {
        console.warn('Could not load map data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden">
      {/* 3D Globe — data passed from HomePage */}
      <Globe3D distributions={distributions} speciesImages={speciesImages} species={species} />

      {/* Search — bottom left */}
      <div className="absolute bottom-4 left-4 z-20 w-72">
        <SearchBar />
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
        className="w-full bg-deep-sea-800/95 backdrop-blur border border-deep-sea-600 text-gray-200 text-sm rounded-full px-4 py-2.5 pl-10 pr-16 sm:px-5 sm:py-3 sm:pl-12 focus:border-ocean-accent focus:outline-none shadow-xl"
      />
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base sm:text-lg">🔍</span>
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-ocean-accent hover:bg-ocean-cyan text-deep-sea-900 text-xs font-bold px-3 py-1 sm:px-4 sm:py-1.5 rounded-full transition-colors"
      >
        搜索
      </button>
    </form>
  )
}
