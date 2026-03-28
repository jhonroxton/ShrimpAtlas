// @ts-nocheck
/**
 * ShrimpLayer.ts — Species distribution data layer
 *
 * Features:
 * - Cesium point entities with glow effect
 * - Clustering at world/region view (auto, via pixelDistance)
 * - LOD: world=glow-dots, region=colored-dots, species=image billboards
 * - Hover: highlight glow
 * - Click: fire onPointClick callback
 */
import type { SpeciesDistribution } from '../../types/shrimp'

// ── Glow dot SVG (world view) ────────────────────────────────────────────────
function dotSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <defs><radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient></defs>
    <circle cx="8" cy="8" r="7" fill="url(#g)"/>
    <circle cx="8" cy="8" r="3.2" fill="${color}"/>
    <circle cx="8" cy="8" r="1.3" fill="white" opacity="0.9"/>
  </svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

// ── Shrimp SVG (species view fallback) ─────────────────────────────────────
function shrimpSvg(color: string): string {
  const b = color; const a = color === '#00D4FF' ? '#00A8CC' : '#5A1FCF'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
    <defs><filter id="g" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter></defs>
    <ellipse cx="30" cy="56" rx="11" ry="3" fill="black" opacity="0.25"/>
    <path d="M15 38 Q11 30 17 24 Q23 30 15 38Z" fill="${a}" opacity="0.9"/>
    <path d="M45 38 Q49 30 43 24 Q37 30 45 38Z" fill="${a}" opacity="0.9"/>
    <path d="M17 40 Q30 36 43 40 Q30 34 17 40Z" fill="${a}" opacity="0.7"/>
    <ellipse cx="30" cy="34" rx="13" ry="17" fill="${b}" filter="url(#g)"/>
    <path d="M18 28 Q30 24 42 28" stroke="${a}" stroke-width="1" fill="none" opacity="0.5"/>
    <path d="M17 34 Q30 30 43 34" stroke="${a}" stroke-width="1" fill="none" opacity="0.5"/>
    <path d="M18 40 Q30 36 42 40" stroke="${a}" stroke-width="1" fill="none" opacity="0.5"/>
    <circle cx="24" cy="18" r="3.2" fill="white" opacity="0.95"/>
    <circle cx="36" cy="18" r="3.2" fill="white" opacity="0.95"/>
    <circle cx="24" cy="18" r="1.8" fill="#071220"/>
    <circle cx="36" cy="18" r="1.8" fill="#071220"/>
    <path d="M26 15 Q21 6 13 3" stroke="${b}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M34 15 Q39 6 47 3" stroke="${b}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  </svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

// ── Glow ring (species view) ───────────────────────────────────────────────
function glowRing(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
    <defs><radialGradient id="rg" cx="50%" cy="50%" r="50%">
      <stop offset="55%" stop-color="transparent"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.4"/>
    </radialGradient></defs>
    <circle cx="44" cy="44" r="42" fill="url(#rg)"/>
  </svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

// ── IUCN status → color ────────────────────────────────────────────────────
const IUCN_COLOR_MAP: Record<string, string> = {
  EX: '#ff0000', EW: '#ff8c00', CR: '#ff4444', EN: '#ff8800',
  VU: '#ffcc00', NT: '#ccdd00', LC: '#44cc44', DD: '#888888', NE: '#cccccc',
}

const VERIFIED_COLOR = '#00D4FF'
const UNVERIFIED_COLOR = '#7B2FFF'

export interface ShrimpLayerOptions {
  viewer: any
  Ces: any
  distributions: SpeciesDistribution[]
  speciesImages: Record<string, string>
  lod: 'world' | 'region' | 'species'
  /** Called when user clicks a point */
  onPointClick?: (dist: SpeciesDistribution) => void
  /** Called on hover */
  onPointHover?: (dist: SpeciesDistribution | null) => void
  /** IUCN status map per species_id */
  iucnStatus?: Record<string, string>
}

export class ShrimpLayer {
  private viewer: any
  private Ces: any
  private _entities: any[] = []

  constructor(options: ShrimpLayerOptions) {
    this.viewer = options.viewer
    this.Ces    = options.Ces
    this.build(options)
  }

  private build(options: ShrimpLayerOptions) {
    const { distributions, speciesImages, lod, onPointClick, onPointHover, iucnStatus } = options
    const C = this.Ces

    // Clear old entities
    this._entities.forEach(e => this.viewer.entities.remove(e))
    this._entities = []

    if (!distributions.length) return

    if (lod === 'world') {
      // ── World view: clustered glow dots ─────────────────────────────────
      const byColor: Record<string, SpeciesDistribution[]> = {}
      for (const d of distributions) {
        const iucn = iucnStatus?.[d.species_id]
        const color = iucn ? (IUCN_COLOR_MAP[iucn] ?? UNVERIFIED_COLOR) : (d.is_verified ? VERIFIED_COLOR : UNVERIFIED_COLOR)
        ;(byColor[color] ??= []).push(d)
      }

      for (const [color, pts] of Object.entries(byColor)) {
        const ent = this.viewer.entities.add({
          position: C.Cartesian3.fromDegreesArrayHeights(
            pts.flatMap(d => [d.longitude, d.latitude, 0])
          ),
          billboard: {
            image: dotSvg(color),
            width: 18, height: 18,
            verticalOrigin: C.VerticalOrigin.CENTER,
            heightReference: C.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          // Clustering config
            pixelRange: 40,
            minimumClusterSize: 3,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        this._entities.push(ent)
      }

    } else if (lod === 'region') {
      // ── Region view: individual colored dots ──────────────────────────────
      for (const d of distributions) {
        const iucn = iucnStatus?.[d.species_id]
        const color = iucn ? (IUCN_COLOR_MAP[iucn] ?? UNVERIFIED_COLOR) : (d.is_verified ? VERIFIED_COLOR : UNVERIFIED_COLOR)
        const ent = this.viewer.entities.add({
          position: C.Cartesian3.fromDegrees(d.longitude, d.latitude),
          point: {
            pixelSize: d.is_verified ? 12 : 8,
            color: C.Color.fromCssColorString(color).withAlpha(0.9),
            outlineColor: C.Color.WHITE.withAlpha(0.6),
            outlineWidth: 1.5,
          },
          properties: { _dist: d },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        this._entities.push(ent)

        if (onPointClick) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(ent as any)._onClick = () => onPointClick(d)
        }
      }

    } else {
      // ── Species view: image / shrimp SVG + glow ─────────────────────────
      for (const d of distributions) {
        const url = speciesImages[d.species_id]
        const ver  = !!d.is_verified
        const color = ver ? VERIFIED_COLOR : UNVERIFIED_COLOR

        // Halo
        const ring = this.viewer.entities.add({
          position: C.Cartesian3.fromDegrees(d.longitude, d.latitude),
          billboard: {
            image: glowRing(color), width: 88, height: 88,
            verticalOrigin: C.VerticalOrigin.CENTER,
            heightReference: C.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
        this._entities.push(ring)

        // Species image or shrimp SVG
        const ent = this.viewer.entities.add({
          position: C.Cartesian3.fromDegrees(d.longitude, d.latitude),
          billboard: {
            image: url ?? shrimpSvg(color),
            width: 64, height: 64,
            verticalOrigin: C.VerticalOrigin.BOTTOM,
            heightReference: C.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          properties: { _dist: d },
        })
        this._entities.push(ent)

        if (onPointClick) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(ent as any)._onClick = () => onPointClick(d)
        }
        if (onPointHover) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(ent as any)._onHover = () => onPointHover(d)
        }
      }
    }
  }

  /** Rebuild layer with new options (called on LOD / data change) */
  rebuild(options: ShrimpLayerOptions) {
    this.build(options)
  }

  /** Remove all entities */
  destroy() {
    this._entities.forEach(e => this.viewer.entities.remove(e))
    this._entities = []
  }

  get entities() { return this._entities }
}
