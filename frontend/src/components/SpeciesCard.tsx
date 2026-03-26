import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShrimpSpecies } from '../types'

interface SpeciesCardProps {
  species: ShrimpSpecies
  onViewOnMap?: (id: string) => void
}

const IUCN_COLORS: Record<string, string> = {
  CR: 'bg-red-900 text-red-300',
  EN: 'bg-orange-900 text-orange-300',
  VU: 'bg-yellow-900 text-yellow-300',
  NT: 'bg-blue-900 text-blue-300',
  LC: 'bg-green-900 text-green-300',
  DD: 'bg-gray-700 text-gray-400',
}

const HABITAT_LABELS: Record<string, string> = {
  deep_sea: '深海',
  coastal: '近海',
  freshwater: '淡水',
  brackish: '汽水',
}

export default function SpeciesCard({ species, onViewOnMap }: SpeciesCardProps) {
  const [imgError, setImgError] = useState(false)

  const iucnColor = IUCN_COLORS[species.iucn_status] || IUCN_COLORS.DD
  const habitatLabel = HABITAT_LABELS[species.habitat] || species.habitat || '未知'
  const fallbackImg = `https://via.placeholder.com/400x240/0A1628/00D4FF?text=${encodeURIComponent(species.cn_name || species.en_name)}`

  return (
    <div className="bg-deep-sea-800 border border-deep-sea-600 rounded-xl overflow-hidden hover:border-ocean-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-ocean-accent/10 group">
      {/* Image */}
      <div className="relative h-48 bg-deep-sea-900 overflow-hidden">
        {!imgError && species.images?.[0] ? (
          <img
            src={species.images[0]}
            alt={species.cn_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-deep-sea-700">
            <span className="text-5xl">🦐</span>
          </div>
        )}

        {/* IUCN Badge */}
        {species.iucn_status && (
          <span className={`absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded ${iucnColor}`}>
            {species.iucn_status}
          </span>
        )}

        {/* Edible Badge */}
        {species.is_edible && (
          <span className="absolute top-3 left-3 text-xs bg-ocean-accent/90 text-deep-sea-900 font-bold px-2 py-1 rounded">
            🍽️ 可食用
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Names */}
        <div className="mb-2">
          <h3 className="text-lg font-bold text-ocean-accent leading-tight">
            {species.cn_name || species.en_name}
          </h3>
          <p className="text-sm text-gray-400 italic">{species.scientific_name}</p>
          <p className="text-xs text-gray-500">{species.en_name}</p>
        </div>

        {/* Classification */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {species.family && (
            <span className="text-xs bg-deep-sea-700 text-gray-300 px-2 py-1 rounded">
              {species.family}
            </span>
          )}
          {species.genus && (
            <span className="text-xs bg-deep-sea-700 text-gray-300 px-2 py-1 rounded">
              {species.genus}
            </span>
          )}
          <span className="text-xs bg-deep-sea-700 text-gray-300 px-2 py-1 rounded">
            {habitatLabel}
          </span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
          {species.max_length_cm && (
            <div className="bg-deep-sea-700 rounded px-2 py-1">
              <span className="text-gray-400">体长</span>
              <span className="text-gray-200 ml-1">≤{species.max_length_cm}cm</span>
            </div>
          )}
          {species.temperature_zone && (
            <div className="bg-deep-sea-700 rounded px-2 py-1">
              <span className="text-gray-400">温度带</span>
              <span className="text-gray-200 ml-1">{species.temperature_zone}</span>
            </div>
          )}
          {species.diet && (
            <div className="bg-deep-sea-700 rounded px-2 py-1">
              <span className="text-gray-400">食性</span>
              <span className="text-gray-200 ml-1">{species.diet}</span>
            </div>
          )}
          {species.fishing_type && (
            <div className="bg-deep-sea-700 rounded px-2 py-1">
              <span className="text-gray-400">捕捞</span>
              <span className="text-gray-200 ml-1">
                {species.fishing_type === 'wild' ? '野生' : species.fishing_type === 'farmed' ? '养殖' : '野生/养殖'}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            to={`/species/${species.id}`}
            className="flex-1 text-center text-sm bg-ocean-accent hover:bg-ocean-cyan text-deep-sea-900 font-semibold py-2 rounded-lg transition-colors"
          >
            查看详情
          </Link>
          {onViewOnMap && (
            <button
              onClick={() => onViewOnMap(species.id)}
              className="text-sm border border-ocean-accent text-ocean-accent hover:bg-ocean-accent/10 py-2 px-3 rounded-lg transition-colors"
            >
              🌍
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
