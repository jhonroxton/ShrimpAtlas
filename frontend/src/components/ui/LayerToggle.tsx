/**
 * LayerToggle.tsx — Layer visibility toggles + LOD badge
 */
import type { LODLevel } from '../../types/shrimp'

interface Props {
  lod: LODLevel
  vis: { shrimp: boolean; currents: boolean; labels: boolean }
  onToggleShrimp:    (v: boolean) => void
  onToggleCurrents: (v: boolean) => void
}

export default function LayerToggle({ lod, vis, onToggleShrimp, onToggleCurrents }: Props) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">

      {/* LOD badge */}
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1">
        <span className="text-[10px] text-cyan-400/70">
          {lod === 'world' ? '🌐 全球' : lod === 'region' ? '🗺️ 区域' : '🔍 近景'}
        </span>
      </div>

      {/* Toggles */}
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2 flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="accent-cyan-400 w-3.5 h-3.5"
            checked={vis.shrimp}
            onChange={e => onToggleShrimp(e.target.checked)}
          />
          <span className="text-[11px] text-white/70">🦐 物种点</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="accent-cyan-400 w-3.5 h-3.5"
            checked={vis.currents}
            onChange={e => onToggleCurrents(e.target.checked)}
          />
          <span className="text-[11px] text-white/70">🌊 洋流</span>
        </label>
      </div>
    </div>
  )
}
