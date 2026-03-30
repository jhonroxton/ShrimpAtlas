// @ts-nocheck
/**
 * TimeSlider.tsx — 单轴时间维度控制器
 * 水平时间轴：12个月份 + 季节背景 + 滑块选择
 */

import { useState, useCallback, useRef } from 'react'

export interface TimeState {
  season: string | null   // spring | summer | autumn | winter | null
  month: number | null    // 1-12, null=全年
  monthRange: [number, number] | null  // [start, end] inclusive
}

export interface TimeSliderProps {
  onChange: (state: TimeState) => void
}

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

const SEASONS: { key: string; label: string; icon: string; months: number[]; color: string }[] = [
  { key: 'spring', label: '春季', icon: '🌸', months: [3, 4, 5],   color: 'rgba(144,238,144,0.3)' },
  { key: 'summer', label: '夏季', icon: '☀️', months: [6, 7, 8],   color: 'rgba(255,180,50,0.3)'  },
  { key: 'autumn', label: '秋季', icon: '🍂', months: [9, 10, 11], color: 'rgba(255,130,60,0.3)'  },
  { key: 'winter', label: '冬季', icon: '❄️', months: [12, 1, 2],  color: 'rgba(150,200,255,0.3)' },
]

// 月份在轴上的位置百分比
function monthPercent(m: number): number {
  return ((m - 1) / 11) * 100
}

function seasonFromMonth(m: number): string | null {
  for (const s of SEASONS) {
    if (s.months.includes(m)) return s.key
  }
  return null
}

function rangeFromMonth(m: number): [number, number] {
  // 前后各延伸1个月，形成一个范围
  const start = Math.max(1, m - 1)
  const end = Math.min(12, m + 1)
  return [start, end]
}

export default function TimeSlider({ onChange }: TimeSliderProps) {
  const [month, setMonth] = useState<number | null>(null)
  const [monthRange, setMonthRange] = useState<[number, number] | null>(null)
  const [dragging, setDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  // 根据点击/拖拽位置解析月份
  const resolveMonth = useCallback((clientX: number): number => {
    const track = trackRef.current
    if (!track) return 6
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * 11) + 1
  }, [])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    const m = resolveMonth(e.clientX)
    if (month === m) {
      // 再次点击同月份 → 取消选择
      setMonth(null)
      setMonthRange(null)
      onChange({ season: null, month: null, monthRange: null })
    } else {
      setMonth(m)
      setMonthRange(rangeFromMonth(m))
      onChange({ season: seasonFromMonth(m), month: m, monthRange: rangeFromMonth(m) })
    }
  }, [month, onChange, resolveMonth])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    const m = resolveMonth(e.clientX)
    setMonth(m)
    setMonthRange(rangeFromMonth(m))
    onChange({ season: seasonFromMonth(m), month: m, monthRange: rangeFromMonth(m) })
  }, [onChange, resolveMonth])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const m = resolveMonth(e.clientX)
    setMonth(m)
    setMonthRange(rangeFromMonth(m))
    onChange({ season: seasonFromMonth(m), month: m, monthRange: rangeFromMonth(m) })
  }, [dragging, onChange, resolveMonth])

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  const reset = () => {
    setMonth(null)
    setMonthRange(null)
    onChange({ season: null, month: null, monthRange: null })
  }

  // 当前显示文字
  const currentLabel = month
    ? `${MONTHS[month - 1]}（前后各1个月）`
    : '全年'

  const seasonColor: Record<string, string> = {
    spring: '#90EE90',
    summer: '#FFB432',
    autumn: '#FF8246',
    winter: '#96C8FF',
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(4,12,28,0.90)',
      border: '1px solid rgba(0,212,255,0.25)',
      borderRadius: '16px',
      padding: '14px 20px 16px',
      backdropFilter: 'blur(16px)',
      zIndex: 100,
      minWidth: '620px',
      userSelect: 'none',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,212,255,0.08)',
    }}
    onMouseMove={handleMouseMove}
    onMouseUp={handleMouseUp}
    onMouseLeave={handleMouseUp}
    >
      {/* 标题行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#7ec8e3', letterSpacing: '0.1em', fontWeight: 600 }}>
          ⏱ 时间维度
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#0fdfff', fontWeight: 600 }}>{currentLabel}</span>
          {month && (
            <button
              onClick={reset}
              style={{
                background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)',
                borderRadius: '6px', color: '#7ec8e3', cursor: 'pointer',
                fontSize: '10px', padding: '2px 8px',
              }}
            >
              重置
            </button>
          )}
        </div>
      </div>

      {/* 时间轴主体 */}
      <div style={{ position: 'relative', height: '52px' }}>

        {/* 季节背景条 */}
        {SEASONS.map(season => {
          const startM = Math.min(...season.months)
          const endM = Math.max(...season.months)
          const leftPct = monthPercent(startM)
          const widthPct = monthPercent(endM) - leftPct + (100 / 11)
          return (
            <div key={season.key} style={{
              position: 'absolute',
              top: 0, height: '100%',
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              background: season.color,
              borderRadius: '6px',
              opacity: month && !SEASONS.find(s => s.key === seasonFromMonth(month))?.months.includes(month) ? 0.3 : 0.8,
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#fff',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}>
              {season.icon} {season.label}
            </div>
          )
        })}

        {/* 可点击轨道 */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          style={{
            position: 'absolute',
            top: 0, height: '100%',
            left: 0, right: 0,
            cursor: 'crosshair',
            zIndex: 5,
          }}
        />

        {/* 选中月份高亮标记 */}
        {monthRange && (
          <div style={{
            position: 'absolute',
            top: 0, height: '100%',
            left: `${monthPercent(monthRange[0])}%`,
            width: `${monthPercent(monthRange[1]) - monthPercent(monthRange[0])}%`,
            background: 'rgba(0,212,255,0.35)',
            borderTop: '3px solid #0fdfff',
            borderBottom: '3px solid #0fdfff',
            borderRadius: '4px',
            zIndex: 3,
            pointerEvents: 'none',
            transition: dragging ? 'none' : 'left 0.15s, width 0.15s',
          }} />
        )}

        {/* 拖拽手柄 */}
        {month && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              top: '50%',
              left: `${monthPercent(month)}%`,
              transform: 'translate(-50%, -50%)',
              width: '18px',
              height: '18px',
              background: '#0fdfff',
              border: '2px solid white',
              borderRadius: '50%',
              boxShadow: '0 0 8px rgba(0,212,255,0.8)',
              zIndex: 10,
              cursor: 'grab',
              transition: dragging ? 'none' : 'left 0.15s',
            }}
          />
        )}

        {/* 月份刻度 */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: month ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
          fontWeight: month ? 700 : 400,
          zIndex: 6,
          pointerEvents: 'none',
          transition: 'color 0.2s',
        }}>
          {MONTHS.map((label, i) => (
            <span
              key={i}
              style={{
                color: monthRange && i + 1 >= monthRange[0] && i + 1 <= monthRange[1]
                  ? '#0fdfff' : undefined,
                fontWeight: monthRange && i + 1 === month ? 700 : 400,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* 季节快速按钮 */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        {SEASONS.map(s => (
          <button
            key={s.key}
            onClick={() => {
              if (s.key === seasonFromMonth(month)) {
                reset()
              } else {
                const midM = s.months[1]
                setMonth(midM)
                setMonthRange([s.months[0], s.months[2]])
                onChange({ season: s.key, month: midM, monthRange: [s.months[0], s.months[2]] })
              }
            }}
            style={{
              flex: 1,
              padding: '5px 0',
              background: seasonFromMonth(month) === s.key
                ? seasonColor[s.key].replace('0.3', '0.5')
                : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${seasonFromMonth(month) === s.key ? seasonColor[s.key] : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '7px',
              color: seasonFromMonth(month) === s.key ? seasonColor[s.key] : '#aaa',
              cursor: 'pointer', fontSize: '11px',
              transition: 'all 0.2s',
            }}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
