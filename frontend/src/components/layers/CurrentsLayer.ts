// @ts-nocheck
/**
 * CurrentsLayer.ts — Ocean currents with animated glow polylines
 *
 * Each current is a warm (red) or cold (blue) polyline with:
 * - Glow material (PolylineGlowMaterialProperty)
 * - Optional arrowhead dots along the path
 */
export interface CurrentSegment {
  name: string
  type: 'warm' | 'cold'
  /** [lon, lat][] waypoints */
  coords: [number, number][]
}

export const DEFAULT_CURRENTS: CurrentSegment[] = [
  { name: '黑潮',           type: 'warm', coords: [[130,20],[140,28],[150,35],[165,42],[180,45]] },
  { name: '湾流',           type: 'warm', coords: [[-80,22],[-70,30],[-60,40],[-50,50],[-30,58]] },
  { name: '加利福尼亚寒流',  type: 'cold', coords: [[-115,45],[-122,38],[-128,28],[-130,18]] },
  { name: '秘鲁寒流',       type: 'cold', coords: [[-80,-5],[-85,-12],[-90,-18],[-95,-25]] },
  { name: '厄加勒斯暖流',   type: 'warm', coords: [[20,-30],[30,-35],[40,-38],[50,-40]] },
  { name: '北太平洋暖流',   type: 'warm', coords: [[130,45],[150,50],[170,50]] },
  { name: '南极绕极流',     type: 'cold', coords: [[-180,-55],[0,-55],[180,-55]] },
]

export class CurrentsLayer {
  private viewer: any
  private Ces: any
  private _entities: any[] = []

  constructor(viewer: any, Ces: any) {
    this.viewer = viewer
    this.Ces    = Ces
    this.build()
  }

  private build() {
    const C = this.Ces

    for (const curr of DEFAULT_CURRENTS) {
      const flat = curr.coords.flatMap(([lon, lat]) => [lon, lat, 0])

      // Glow polyline
      const ent = this.viewer.entities.add({
        name: curr.name,
        polyline: {
          positions: C.Cartesian3.fromDegreesArrayHeights(flat),
          width: 2.5,
          material: new C.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            color: curr.type === 'warm'
              ? C.Color.fromBytes(255, 100, 80, 160)
              : C.Color.fromBytes(60, 160, 255, 160),
          }),
          arcType: C.ArcType.GEODESIC,
        },
      })
      ;(ent as any)._isCurrent = true
      this._entities.push(ent)

      // Animated dot markers along the path (waypoint arrows)
      for (let i = 0; i < curr.coords.length; i++) {
        const [lon, lat] = curr.coords[i]
        const dotColor = curr.type === 'warm'
          ? C.Color.fromBytes(255, 180, 100, 220)
          : C.Color.fromBytes(100, 200, 255, 220)

        const dotEnt = this.viewer.entities.add({
          position: C.Cartesian3.fromDegrees(lon, lat),
          point: {
            pixelSize: 6,
            color: dotColor,
            outlineColor: C.Color.WHITE.withAlpha(0.8),
            outlineWidth: 1,
          },
        })
        ;(dotEnt as any)._isCurrent = true
        this._entities.push(dotEnt)
      }
    }
  }

  show()  { this._entities.forEach(e => { e.show = true })  }
  hide()  { this._entities.forEach(e => { e.show = false }) }

  destroy() {
    this._entities.forEach(e => this.viewer.entities.remove(e))
    this._entities = []
  }
}
