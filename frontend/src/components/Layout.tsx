import { Outlet, Link } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="min-h-screen bg-deep-sea-900 text-gray-200">
      {/* Header */}
      <header className="bg-deep-sea-800 border-b border-deep-sea-600 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦐</span>
            <Link to="/" className="text-xl font-bold text-ocean-accent">
              ShrimpAtlas
            </Link>
          </div>
          <nav className="flex items-center gap-6">
            <Link to="/" className="hover:text-ocean-accent transition-colors">
              🌍 地球
            </Link>
            <Link to="/species" className="hover:text-ocean-accent transition-colors">
              🦐 物种库
            </Link>
            <Link to="/search" className="hover:text-ocean-accent transition-colors">
              🔍 搜索
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-deep-sea-800 border-t border-deep-sea-600 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          <p>ShrimpAtlas — 探索全球虾类分布，感受海洋生态之美</p>
          <p className="mt-1">数据来源: WoRMS · IUCN Red List · NOAA</p>
        </div>
      </footer>
    </div>
  )
}
