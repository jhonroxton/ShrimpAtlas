// @ts-nocheck
/**
 * DetailCard.tsx — 物种详情卡片
 */

import { useState } from 'react'
import { IUCN_COLORS, IUCN_LABELS } from '../types/shrimp'

interface CardData {
  id: string
  cn_name?: string
  en_name?: string
  scientific_name?: string
  family?: string
  genus?: string
  iucn_status?: string
  images?: string[]
  habitat?: string
  temperature_zone?: string
  is_edible?: boolean
  max_length_cm?: number
  diet?: string
}

interface DetailCardProps {
  data: CardData
  onClose: () => void
}

export default function DetailCard({ data, onClose }: DetailCardProps) {
  const [imgError, setImgError] = useState(false)

  const iucnColor = IUCN_COLORS[data.iucn_status || ''] || '#AAAAAA'
  const iucnLabel = data.iucn_status
    ? `${data.iucn_status} (${IUCN_LABELS[data.iucn_status] || data.iucn_status})`
    : '—'
  const maxLen = data.max_length_cm ? `${data.max_length_cm} cm` : '—'
  const edible = data.is_edible ? '✅ 可食用' : '⚠️ 不可食用'
  const cnName = data.cn_name || data.en_name || '—'

  return (
    <div style={{
      width: '320px',
      background: 'rgba(5,15,35,0.96)',
      border: '1.5px solid rgba(0,212,255,0.5)',
      borderRadius: '16px',
      padding: '20px',
      color: 'white',
      fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 30px rgba(0,212,255,0.12)',
    }}>
      {/* 关闭按钮 */}
      <button onClick={onClose} style={{
        position: 'absolute', top: '12px', right: '12px',
        background: 'rgba(255,255,255,0.1)', border: 'none',
        color: '#aaa', cursor: 'pointer', fontSize: '18px',
        padding: '4px 8px', borderRadius: '6px',
      }}>✕</button>

      {/* 图片 */}
      <div style={{
        width: '100%', height: '160px', borderRadius: '10px',
        background: '#0a1a2e', marginBottom: '14px', overflow: 'hidden',
      }}>
        {!imgError && data.images?.[0] ? (
          <img
            src={data.images[0]}
            alt={cnName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '48px' }}>🦐</span>
          </div>
        )}
      </div>

      {/* 名称 */}
      <div style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFD700', marginBottom: '4px' }}>
          {cnName}
        </div>
        <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>
          {data.scientific_name || '—'}
        </div>
        <div style={{ fontSize: '11px', color: '#777' }}>{data.en_name || ''}</div>
      </div>

      {/* 属性网格 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '6px', fontSize: '12px', marginBottom: '10px',
      }}>
        {[
          ['保护状态', iucnLabel, iucnColor],
          ['最大体长', maxLen, '#ddd'],
          ['温度带', data.temperature_zone || '—', '#ddd'],
          ['食性', data.diet ? data.diet.substring(0, 6) : '—', '#ddd'],
        ].map(([label, val, color], i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
            <span style={{ color: '#888' }}>{label}</span>
            <div style={{ color: color as string, marginTop: '2px' }}>{val as string}</div>
          </div>
        ))}
      </div>

      {/* 栖息地 */}
      <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>
        🌊 栖息地：<span style={{ color: '#ccc' }}>{data.habitat || '—'}</span>
      </div>

      {/* 标签 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {data.family && (
          <span style={{ fontSize: '10px', background: 'rgba(0,212,255,0.15)', color: '#7FD1D1', padding: '3px 8px', borderRadius: '20px' }}>
            {data.family}
          </span>
        )}
        {data.genus && (
          <span style={{ fontSize: '10px', background: 'rgba(0,212,255,0.15)', color: '#7FD1D1', padding: '3px 8px', borderRadius: '20px' }}>
            {data.genus}
          </span>
        )}
        <span style={{
          fontSize: '10px',
          background: data.is_edible ? 'rgba(127,209,127,0.2)' : 'rgba(255,127,127,0.2)',
          color: data.is_edible ? '#7FD17F' : '#FF7F7F',
          padding: '3px 8px', borderRadius: '20px',
        }}>
          {edible}
        </span>
      </div>

      {/* 详情链接 */}
      <a href={`/species/${data.id}`} style={{
        display: 'block', textAlign: 'center',
        background: 'rgba(0,212,255,0.9)', color: '#001020',
        fontWeight: 'bold', fontSize: '13px',
        padding: '10px', borderRadius: '10px', textDecoration: 'none',
      }}>
        查看详情 →
      </a>
    </div>
  )
}
