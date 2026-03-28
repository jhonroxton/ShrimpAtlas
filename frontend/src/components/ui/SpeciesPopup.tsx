/**
 * SpeciesPopup.tsx — Click-to-show species detail card
 *
 * Shows: image, cn_name, en_name, scientific name,
 *        IUCN status badge, family, habitat, description
 * Animated in with a fade + slide-up effect
 * Dismiss: click X or click outside
 */
import { useEffect, useRef } from 'react'
import type { SpeciesDetail } from '../../types/shrimp'
import { IUCN_COLORS, IUCN_LABELS } from '../../types/shrimp'

interface Props {
  species: SpeciesDetail | null
  onClose: () => void
}

export default function SpeciesPopup({ species, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Click outside to dismiss
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!species) return null

  const status = species.iucn_status ?? 'NE'
  const statusColor = IUCN_COLORS[status] ?? '#888'
  const statusLabel = IUCN_LABELS[status] ?? '未评估'

  const imgUrl = species.images?.[0]
    ?? `/species-images/${species.scientific_name.replace(/ /g, '_')}/1.jpg`

  return (
    <div
      ref={ref}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm animate-popup-in"
      style={{
        animation: 'popupIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 rounded-2xl" onClick={onClose} />

      <div className="bg-[#0d1f35]/95 backdrop-blur-md border border-[#1e3a5f] rounded-2xl overflow-hidden shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white/70 hover:text-white text-sm transition-colors"
        >
          ✕
        </button>

        {/* Image */}
        <div className="relative h-48 bg-[#071220] overflow-hidden">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={species.cn_name || species.scientific_name}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl opacity-30">🦐</div>
          )}
          {/* IUCN badge */}
          <div
            className="absolute bottom-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full text-white"
            style={{ backgroundColor: statusColor + 'cc' }}
          >
            {statusLabel}
          </div>
        </div>

        {/* Info */}
        <div className="p-4 space-y-2">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">
              {species.cn_name || species.scientific_name}
            </h2>
            {species.en_name && (
              <p className="text-gray-400 text-xs italic">{species.en_name}</p>
            )}
            <p className="text-cyan-400 text-xs mt-0.5">{species.scientific_name}</p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
              {species.family} 科
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
              {species.genus} 属
            </span>
            {species.habitat && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                {species.habitat}
              </span>
            )}
          </div>

          {species.max_length_cm && (
            <p className="text-gray-500 text-xs">
              最大体长：<span className="text-gray-300">{species.max_length_cm} cm</span>
            </p>
          )}

          {species.temperature_zone && (
            <p className="text-gray-500 text-xs">
              温度带：<span className="text-gray-300">{species.temperature_zone}</span>
            </p>
          )}

          {species.is_edible && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <span>✅</span>
              <span>可食用</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes popupIn {
          from { opacity: 0; transform: translate(-50%, -45%) scale(0.92); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  )
}
