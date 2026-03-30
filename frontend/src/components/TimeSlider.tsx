// @ts-nocheck
/**
 * TimeSlider.tsx — 时间维度控制器
 * 支持季节切换（春/夏/秋/冬）和月份选择
 */

import { useState } from 'react'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface TimeState {
  season: Season | null
  month: number | null  // 1-12, null = 全年
}

export interface TimeSliderProps {
  onChange: (state: TimeState) => void
}

const SEASONS: { value: Season; label: string; icon: string; months: number[] }[] = [
  { value: 'spring', label: '春', icon: '🌸', months: [3, 4, 5] },
  { value: 'summer', label: '夏', icon: '☀️', months: [6, 7, 8] },
  { value: 'autumn', label: '秋', icon: '🍂', months: [9, 10, 11] },
  { value: 'winter', label: '冬', icon: '❄️', months: [12, 1, 2] },
]

const MONTHS = [
  { m: 1,  label: '1月' }, { m: 2,  label: '2月' },
  { m: 3,  label: '3月' }, { m: 4,  label: '4月' },
  { m: 5,  label: '5月' }, { m: 6,  label: '6月' },
  { m: 7,  label: '7月' }, { m: 8,  label: '8月' },
  { m: 9,  label: '9月' }, { m: 10, label: '10月' },
  { m: 11, label: '11月' },{ m: 12, label: '12月' },
]

export default function TimeSlider({ onChange }: TimeSliderProps) {
  const [timeState, setTimeState] = useState<TimeState>({ season: null, month: null })

  const selectSeason = (season: Season) => {
    const next: TimeState = {
      season: timeState.season === season ? null : season,
      month: null,
    }
    setTimeState(next)
    onChange(next)
  }

  const selectMonth = (month: number) => {
    const next: TimeState = {
      season: null,
      month: timeState.month === month ? null : month,
    }
    setTimeState(next)
    onChange(next)
  }

  const reset = () => {
    const next: TimeState = { season: null, month: null }
    setTimeState(next)
    onChange(next)
  }

  const currentLabel = timeState.season
    ? SEASONS.find(s => s.value === timeState.season)?.icon + ' ' + SEASONS.find(s => s.value === timeState.season)?.label + '季'
    : timeState.month
      ? MONTHS[timeState.month - 1]?.label
      : '全年'

  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(4,12,28,0.88)',
      border: '1px solid rgba(0,212,255,0.25)',
      borderRadius: '14px',
      padding: '12px 18px 14px',
      backdropFilter: 'blur(16px)',
      zIndex: 100,
      minWidth: '480px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,212,255,0.08)',
    }}>
      {/* 标题行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', color: '#7ec8e3', letterSpacing: '0.1em', fontWeight: 600 }}>
          ⏱ 时间维度
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#0fdfff', fontWeight: 600 }}>{currentLabel}</span>
          {(timeState.season || timeState.month) && (
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

      {/* 季节按钮 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {SEASONS.map(s => (
          <button
            key={s.value}
            onClick={() => selectSeason(s.value)}
            style={{
              flex: 1,
              padding: '6px 4px',
              background: timeState.season === s.value
                ? 'rgba(0,212,255,0.2)'
                : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${timeState.season === s.value ? '#0fdfff' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '8px',
              color: timeState.season === s.value ? '#0fdfff' : '#aaa',
              cursor: 'pointer', fontSize: '12px',
              transition: 'all 0.2s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            }}
          >
            <span style={{ fontSize: '16px' }}>{s.icon}</span>
            <span>{s.label}季</span>
          </button>
        ))}
      </div>

      {/* 月份细粒度滑块 */}
      <div>
        <div style={{ fontSize: '10px', color: '#555', marginBottom: '6px' }}>或选择月份（细粒度）</div>
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
          {MONTHS.map(({ m, label }) => (
            <button
              key={m}
              onClick={() => selectMonth(m)}
              style={{
                flex: '1 0 calc(16.66% - 3px)',
                padding: '4px 0',
                background: timeState.month === m
                  ? 'rgba(0,212,255,0.2)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${timeState.month === m ? '#0fdfff' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '5px',
                color: timeState.month === m ? '#0fdfff' : '#777',
                cursor: 'pointer', fontSize: '10px',
                transition: 'all 0.15s',
                minWidth: 0,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 说明文字 */}
      <div style={{ fontSize: '10px', color: '#444', marginTop: '8px', textAlign: 'center' }}>
        💡 选择季节或月份，地图仅显示该时期活跃的物种分布
      </div>
    </div>
  )
}
