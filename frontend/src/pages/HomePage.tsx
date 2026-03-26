export default function HomePage() {
  return (
    <div className="relative w-full h-[calc(100vh-64px)] bg-deep-sea-900">
      {/* 3D Globe Placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-4 animate-pulse">🌍</div>
          <h1 className="text-3xl font-bold text-ocean-accent mb-2">
            ShrimpAtlas
          </h1>
          <p className="text-gray-400 max-w-md mx-auto">
            以3D地球为载体，探索全球虾类分布，感受海洋生态之美
          </p>
          <div className="mt-6 flex gap-4 justify-center">
            <button className="px-6 py-3 bg-ocean-accent text-deep-sea-900 rounded-lg font-semibold hover:bg-ocean-cyan transition-colors">
              开始探索
            </button>
            <button className="px-6 py-3 border border-ocean-accent text-ocean-accent rounded-lg hover:bg-ocean-accent/10 transition-colors">
              了解更多
            </button>
          </div>
        </div>
      </div>

      {/* Control Panel Placeholder */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-deep-sea-800/90 backdrop-blur border border-deep-sea-600 rounded-xl p-4 flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" defaultChecked className="accent-ocean-accent" />
          <span className="text-sm text-gray-300">🌊 洋流</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" defaultChecked className="accent-ocean-accent" />
          <span className="text-sm text-gray-300">🦐 物种分布</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="accent-ocean-accent" />
          <span className="text-sm text-gray-300">🌀 季风</span>
        </label>
      </div>
    </div>
  )
}
