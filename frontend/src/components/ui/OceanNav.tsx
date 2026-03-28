/**
 * OceanNav.tsx — Quick-jump ocean buttons (bottom right)
 */
interface Props {
  onFly: (ocean: string) => void
  visible?: boolean
}

const OCEANS = [
  { label: '太平洋', emoji: '🌊' },
  { label: '大西洋', emoji: '🌊' },
  { label: '印度洋', emoji: '🌊' },
  { label: '北冰洋', emoji: '❄️' },
  { label: '南大洋', emoji: '🌊' },
]

export default function OceanNav({ onFly, visible }: Props) {
  if (!visible) return null

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <div className="flex flex-wrap gap-1 max-w-[130px] justify-end">
        {OCEANS.map(({ label, emoji }) => (
          <button
            key={label}
            onClick={() => onFly(label)}
            className="flex items-center gap-1 text-[10px] text-white/50 hover:text-cyan-400 transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-cyan-400/30"
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
