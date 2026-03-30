// @ts-nocheck
/**
 * Sidebar.tsx — 侧边栏筛选面板
 * 支持: 栖息环境 / IUCN状态 / 温度带 / 是否可食用 / 捕捞方式 / 搜索
 */

import { useState, useCallback } from 'react'

export interface FilterState {
  search: string
  habitat: string[]        // coastal | freshwater | deepsea | all
  iucnStatus: string[]     // LC | NT | VU | EN | CR | DD | ...
  temperatureZone: string[] // tropical | temperate | cold | all
  isEdible: boolean | null // true | false | null(all)
  fishingType: string[]    // wild | farmed | both | all
}

export interface SidebarProps {
  species: any[]
  totalDistCount: number
  onFilterChange: (filtered: any[], filters: FilterState) => void
  onFlyTo?: (lon: number, lat: number) => void
}

const HABITAT_OPTIONS = [
  { value: 'coastal',   label: '🌊 沿海' },
  { value: 'freshwater',label: '🏞 淡水' },
  { value: 'deepsea',   label: '🌊 深海' },
  { value: 'reef',      label: '🪸 珊瑚礁' },
  { value: 'estuary',   label: '🏔 河口' },
]

const TEMP_ZONE_OPTIONS = [
  { value: 'tropical', label: '🔥 热带' },
  { value: 'temperate',label: '🍂 温带' },
  { value: 'cold',     label: '❄️ 寒带' },
  { value: 'polar',    label: '🧊 极地' },
]

const IUCN_OPTIONS = [
  { value: 'LC', label: '🟢 无危',     color: '#44cc44' },
  { value: 'NT', label: '🟡 近危',     color: '#ccdd00' },
  { value: 'VU', label: '🟠 易危',     color: '#ffcc00' },
  { value: 'EN', label: '🟠 濒危',     color: '#ff8800' },
  { value: 'CR', label: '🔴 极危',     color: '#ff4444' },
  { value: 'DD', label: '⚪ 数据缺乏', color: '#888888' },
]

const FISHING_OPTIONS = [
  { value: 'wild',   label: '🎣 野生捕捞' },
  { value: 'farmed', label: '🏗 养殖' },
  { value: 'both',   label: '🔄 两种都有' },
]

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  habitat: [],
  iucnStatus: [],
  temperatureZone: [],
  isEdible: null,
  fishingType: [],
}

export function applyFilters(species: any[], filters: FilterState): any[] {
  return species.filter((sp: any) => {
    // 搜索
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const match = [sp.cn_name, sp.en_name, sp.scientific_name, sp.family, sp.genus]
        .filter(Boolean)
        .some(v => v.toLowerCase().includes(q))
      if (!match) return false
    }
    // 栖息环境
    if (filters.habitat.length > 0) {
      if (!filters.habitat.includes(sp.habitat || '')) return false
    }
    // IUCN
    if (filters.iucnStatus.length > 0) {
      if (!filters.iucnStatus.includes(sp.iucn_status)) return false
    }
    // 温度带
    if (filters.temperatureZone.length > 0) {
      if (!filters.temperatureZone.includes(sp.temperature_zone)) return false
    }
    // 是否可食用
    if (filters.isEdible !== null) {
      if (sp.is_edible !== filters.isEdible) return false
    }
    // 捕捞方式
    if (filters.fishingType.length > 0) {
      if (!filters.fishingType.includes(sp.fishing_type)) return false
    }
    return true
  })
}

export default function Sidebar({ species, totalDistCount, onFilterChange }: SidebarProps) {
  // pendingFilters: 当前用户在界面上选择的条件（未确认）
  const [pendingFilters, setPendingFilters] = useState<FilterState>(DEFAULT_FILTERS)
  // confirmedFilters: 上次点击"确认"后生效的条件
  const [confirmedFilters, setConfirmedFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    habitat: true,
    iucn: true,
    temp: false,
    edible: false,
    fishing: false,
  })

  // 更新待确认条件（仅更新本地状态，不触发过滤）
  const updatePending = useCallback((partial: Partial<FilterState>) => {
    setPendingFilters(prev => ({ ...prev, ...partial }))
  }, [])

  // 确认应用当前条件
  const confirmFilters = useCallback(() => {
    setConfirmedFilters(pendingFilters)
    const filtered = applyFilters(species, pendingFilters)
    onFilterChange(filtered, pendingFilters)
  }, [pendingFilters, species, onFilterChange])

  const toggleArrayFilter = useCallback((key: 'habitat' | 'iucnStatus' | 'temperatureZone' | 'fishingType', value: string) => {
    const current = pendingFilters[key]
    const next = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value]
    updatePending({ [key]: next })
  }, [pendingFilters, updatePending])

  // 重置：恢复默认条件（不清空，但恢复到默认值）
  const resetFilters = useCallback(() => {
    setPendingFilters(DEFAULT_FILTERS)
    // 可选：也立即应用默认条件
    setConfirmedFilters(DEFAULT_FILTERS)
    onFilterChange(species, DEFAULT_FILTERS)
  }, [species, onFilterChange])

  // 预览数量 = 待确认条件的结果
  const pendingCount = applyFilters(species, pendingFilters).length
  const hasChanges = JSON.stringify(pendingFilters) !== JSON.stringify(confirmedFilters)

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const filteredCount = pendingCount

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      width: collapsed ? '48px' : '260px',
      background: 'rgba(4,12,28,0.92)',
      borderRight: '1px solid rgba(0,212,255,0.2)',
      backdropFilter: 'blur(16px)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s ease',
      overflow: 'hidden',
    }}>
      {/* 折叠按钮 */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          position: 'absolute', top: '12px', right: '10px',
          background: 'rgba(255,255,255,0.08)', border: 'none',
          color: '#7ec8e3', cursor: 'pointer', borderRadius: '6px',
          padding: '4px 8px', fontSize: '12px', zIndex: 10,
        }}
      >
        {collapsed ? '→' : '←'}
      </button>

      {!collapsed && (
        <>
          {/* 标题 */}
          <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid rgba(0,212,255,0.1)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#7ec8e3', letterSpacing: '0.05em' }}>
              🦐 物种筛选
            </div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              {hasChanges
                ? <><span style={{ color: '#ffb84d' }}>预览 {pendingCount}</span> / {species.length} 种</>
                : <>已选 <span style={{ color: '#0fdfff' }}>{pendingCount}</span> / {species.length} 种</>
              }
            </div>
          </div>

          {/* 搜索 */}
          <div style={{ padding: '10px 14px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="搜索物种名称..."
                value={pendingFilters.search}
                onChange={e => updatePending({ search: e.target.value })}
                style={{
                  width: '100%', padding: '8px 10px 8px 30px',
                  background: 'rgba(0,212,255,0.06)',
                  border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: '8px', color: 'white',
                  fontSize: '12px', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ position: 'absolute', left: '8px', top: '8px', fontSize: '12px' }}>🔍</span>
            </div>
          </div>

          {/* 筛选区块 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>

            {/* ── 栖息环境 ── */}
            <FilterSection
              title="🏠 栖息环境"
              expanded={expandedSections.habitat}
              onToggle={() => toggleSection('habitat')}
            >
              {HABITAT_OPTIONS.map(opt => (
                <CheckboxItem
                  key={opt.value}
                  label={opt.label}
                  checked={pendingFilters.habitat.includes(opt.value)}
                  onChange={() => toggleArrayFilter('habitat', opt.value)}
                />
              ))}
            </FilterSection>

            {/* ── IUCN状态 ── */}
            <FilterSection
              title="📋 IUCN 状态"
              expanded={expandedSections.iucn}
              onToggle={() => toggleSection('iucn')}
            >
              {IUCN_OPTIONS.map(opt => (
                <CheckboxItem
                  key={opt.value}
                  label={opt.label}
                  checked={pendingFilters.iucnStatus.includes(opt.value)}
                  onChange={() => toggleArrayFilter('iucnStatus', opt.value)}
                  dotColor={opt.color}
                />
              ))}
            </FilterSection>

            {/* ── 温度带 ── */}
            <FilterSection
              title="🌡 温度带"
              expanded={expandedSections.temp}
              onToggle={() => toggleSection('temp')}
            >
              {TEMP_ZONE_OPTIONS.map(opt => (
                <CheckboxItem
                  key={opt.value}
                  label={opt.label}
                  checked={pendingFilters.temperatureZone.includes(opt.value)}
                  onChange={() => toggleArrayFilter('temperatureZone', opt.value)}
                />
              ))}
            </FilterSection>

            {/* ── 是否可食用 ── */}
            <FilterSection
              title="🍽 是否可食用"
              expanded={expandedSections.edible}
              onToggle={() => toggleSection('edible')}
            >
              {[
                { value: true, label: '✅ 可食用' },
                { value: false, label: '⚠️ 不可食用' },
              ].map(opt => (
                <RadioItem
                  key={String(opt.value)}
                  label={opt.label}
                  checked={pendingFilters.isEdible === opt.value}
                  onChange={() => updatePending({ isEdible: opt.value })}
                />
              ))}
              <button
                onClick={() => updatePending({ isEdible: null })}
                style={{
                  background: 'none', border: 'none', color: '#7ec8e3',
                  cursor: 'pointer', fontSize: '11px', padding: '2px 0',
                  textDecoration: 'underline',
                }}
              >
                清除选择
              </button>
            </FilterSection>

            {/* ── 捕捞方式 ── */}
            <FilterSection
              title="🎣 捕捞方式"
              expanded={expandedSections.fishing}
              onToggle={() => toggleSection('fishing')}
            >
              {FISHING_OPTIONS.map(opt => (
                <CheckboxItem
                  key={opt.value}
                  label={opt.label}
                  checked={pendingFilters.fishingType.includes(opt.value)}
                  onChange={() => toggleArrayFilter('fishingType', opt.value)}
                />
              ))}
            </FilterSection>

          </div>

          {/* 按钮区 */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(0,212,255,0.1)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* 确认筛选按钮 */}
            <button
              onClick={confirmFilters}
              disabled={!hasChanges}
              style={{
                width: '100%', padding: '9px',
                background: hasChanges ? 'rgba(0,212,255,0.85)' : 'rgba(0,212,255,0.2)',
                border: 'none',
                borderRadius: '8px', color: hasChanges ? '#001828' : '#7ec8e3',
                cursor: hasChanges ? 'pointer' : 'default',
                fontSize: '13px', fontWeight: 700,
                transition: 'all 0.2s',
                letterSpacing: '0.05em',
              }}
            >
              {hasChanges ? `✓ 确认筛选（${pendingCount} 种）` : '✓ 确认筛选'}
            </button>
            {/* 重置按钮 */}
            <button
              onClick={resetFilters}
              style={{
                width: '100%', padding: '7px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px', color: '#888',
                cursor: 'pointer', fontSize: '12px',
                transition: 'all 0.2s',
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#ccc' }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#888' }}
            >
              🔄 重置
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── 子组件 ──────────────────────────────────────────────────────────────────

function FilterSection({ title, expanded, onToggle, children }: any) {
  return (
    <div style={{ marginBottom: '4px' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none',
          color: '#a0d8ef', cursor: 'pointer', fontSize: '12px',
          fontWeight: 600, padding: '8px 0', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          letterSpacing: '0.03em',
        }}
      >
        {title}
        <span style={{ fontSize: '10px', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
      </button>
      {expanded && (
        <div style={{ paddingLeft: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function CheckboxItem({ label, checked, onChange, dotColor }: { label: string; checked: boolean; onChange: () => void; dotColor?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '3px 0' }}>
      <div
        onClick={onChange}
        style={{
          width: '14px', height: '14px',
          border: `1.5px solid ${checked ? '#0fdfff' : '#555'}`,
          borderRadius: '3px',
          background: checked ? 'rgba(0,212,255,0.25)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.15s',
        }}
      >
        {checked && <span style={{ color: '#0fdfff', fontSize: '9px', lineHeight: 1 }}>✓</span>}
      </div>
      {dotColor && (
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      )}
      <span style={{ color: checked ? '#e0f4ff' : '#888', fontSize: '12px', transition: 'color 0.15s' }}>
        {label}
      </span>
    </label>
  )
}

function RadioItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '3px 0' }}>
      <div
        onClick={onChange}
        style={{
          width: '14px', height: '14px',
          border: `1.5px solid ${checked ? '#0fdfff' : '#555'}`,
          borderRadius: '50%',
          background: checked ? 'rgba(0,212,255,0.25)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.15s',
        }}
      >
        {checked && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0fdfff' }} />}
      </div>
      <span style={{ color: checked ? '#e0f4ff' : '#888', fontSize: '12px', transition: 'color 0.15s' }}>
        {label}
      </span>
    </label>
  )
}
