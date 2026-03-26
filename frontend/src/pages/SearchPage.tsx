import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import SpeciesCard from '../components/SpeciesCard'
import { speciesApi } from '../api/species'
import { ShrimpSpecies } from '../types'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const initialQ = searchParams.get('q') || ''

  const [query, setQuery] = useState(initialQ)
  const [results, setResults] = useState<ShrimpSpecies[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialQ) {
      doSearch(initialQ)
    }
  }, [initialQ])

  const doSearch = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const data = await speciesApi.search(q.trim())
      setResults(data || [])
    } catch (err: any) {
      setError(err.message || '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      doSearch(query.trim())
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ocean-accent mb-4">🔍 搜索虾类</h1>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入中文名、英文名或拉丁学名..."
            className="w-full bg-deep-sea-800 border border-deep-sea-600 text-gray-200 text-base rounded-xl px-5 py-4 pl-12 focus:border-ocean-accent focus:outline-none"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">🔍</span>
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-ocean-accent hover:bg-ocean-cyan text-deep-sea-900 font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            搜索
          </button>
        </form>
      </div>

      {/* Results */}
      {loading && (
        <div className="text-center py-12">
          <div className="text-4xl animate-pulse mb-4">🔍</div>
          <p className="text-gray-400">搜索中...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🦐</div>
          <p className="text-gray-400 mb-2">没有找到 "<span className="text-gray-200">{searchParams.get('q')}</span>"</p>
          <p className="text-gray-500 text-sm">试试输入拉丁学名，如 Penaeus vannamei</p>
          <Link to="/species" className="inline-block mt-4 text-ocean-accent text-sm hover:underline">
            浏览全部物种 →
          </Link>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div>
          <p className="text-gray-400 text-sm mb-4">
            找到 {results.length} 个结果
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((sp) => (
              <SpeciesCard key={sp.id} species={sp} />
            ))}
          </div>
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🌍</div>
          <p className="text-gray-400 mb-2">输入关键词开始搜索</p>
          <div className="mt-6 space-y-2 text-sm text-gray-500">
            <p>💡 试试搜索：</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Penaeus vannamei', '南美白对虾', '北极甜虾', '黑虎虾', '罗氏沼虾'].map((term) => (
                <button
                  key={term}
                  onClick={() => { setQuery(term); doSearch(term) }}
                  className="bg-deep-sea-800 border border-deep-sea-600 text-gray-300 px-3 py-1.5 rounded-full text-xs hover:border-ocean-accent hover:text-ocean-accent transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
