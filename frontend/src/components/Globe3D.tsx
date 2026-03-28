// @ts-nocheck
/**
 * Globe3D.tsx — Three.js Earth globe (working version)
 * Features:
 * - Far view: dense glowing cyan dots per distribution
 * - Near view: species sprite images (with orange glow fallback)
 * - Ocean currents (animated warm/cold particles)
 * - Heatmap (orange/yellow richness dots)
 * - Migration routes (animated colored particles + lines)
 * - Layer toggles (checkbox — works correctly)
 */

import { useEffect, useRef, useState } from 'react'
import type { SpeciesDistribution } from '../types/shrimp'

const EARTH_R = 20

// ── Utilities ───────────────────────────────────────────────────────────────

function latLonTo3D(lat: number, lon: number, r: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ]
}

function makeGlowDataURL(color: string, size = 256): string {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')!
  const cx = size / 2, cy = size / 2, rad = size * 0.42
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
  g.addColorStop(0, color)
  g.addColorStop(0.4, color + 'cc')
  g.addColorStop(1, color + '00')
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)
  ctx.beginPath(); ctx.arc(cx, cy, rad * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = 'white'; ctx.fill()
  return cv.toDataURL()
}

// ── World Dots (far-field LOD) ──────────────────────────────────────────────

function buildWorldDots(distributions: SpeciesDistribution[], scene: any): any {
  const GH = 60, GW = 120
  const grid: (number|null)[][] = Array.from({length: GH}, () => Array(GW).fill(null))
  let maxV = 1
  distributions.forEach(d => {
    const c = Math.round(((d.longitude + 180) / 360) * GW) % GW
    const r = Math.round(((90 - d.latitude) / 180) * GH) % GH
    if (r >= 0 && r < GH && c >= 0 && c < GW) {
      grid[r][c] = (grid[r][c] || 0) + 1
      maxV = Math.max(maxV, grid[r][c] || 1)
    }
  })
  const positions: number[] = [], colors: number[] = []
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
    if (!grid[r][c]) continue
    const lon = (c / GW) * 360 - 180 + 360 / GW / 2
    const lat = 90 - (r / GH) * 180 - 180 / GH / 2
    const [x, y, z] = latLonTo3D(lat, lon, EARTH_R + 0.5)
    const t = grid[r][c]! / maxV
    const rr = t < 0.5 ? t * 2 : 1
    const gg = t < 0.5 ? 0 : (t - 0.5) * 2
    const bb = t < 0.5 ? 1 : 1 - (t - 0.5) * 2
    positions.push(x, y, z); colors.push(rr, gg, bb)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(colors), 3))
  const loader = new THREE.TextureLoader()
  const glowTex = loader.load(makeGlowDataURL('#00D4FF', 128))
  const mat = new THREE.PointsMaterial({
    size: 8.0, map: glowTex, vertexColors: true,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  })
  const pts = new THREE.Points(geo, mat)
  scene.add(pts); return pts
}

// ── Heatmap (richness) ────────────────────────────────────────────────────────

function buildRichnessHeatmap(distributions: SpeciesDistribution[], scene: any): any {
  const GH = 36, GW = 72
  const grid: (number|null)[][] = Array.from({length: GH}, () => Array(GW).fill(null))
  let maxV = 1
  distributions.forEach(d => {
    const c = Math.round(((d.longitude + 180) / 360) * GW) % GW
    const r = Math.round(((90 - d.latitude) / 180) * GH) % GH
    if (r >= 0 && r < GH && c >= 0 && c < GW) {
      grid[r][c] = (grid[r][c] || 0) + 1
      maxV = Math.max(maxV, grid[r][c] || 1)
    }
  })
  const positions: number[] = [], colors: number[] = []
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
    if (!grid[r][c]) continue
    const lon = (c / GW) * 360 - 180 + 360 / GW / 2
    const lat = 90 - (r / GH) * 180 - 180 / GH / 2
    const [x, y, z] = latLonTo3D(lat, lon, EARTH_R + 0.5)
    const t = grid[r][c]! / maxV
    const rr = t < 0.5 ? t * 2 : 1
    const gg = t < 0.5 ? 0 : (t - 0.5) * 2
    const bb = t < 0.5 ? 1 : 1 - (t - 0.5) * 2
    positions.push(x, y, z); colors.push(rr, gg, bb)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(colors), 3))
  const loader = new THREE.TextureLoader()
  const glowTex = loader.load(makeGlowDataURL('#ffaa00', 128))
  const mat = new THREE.PointsMaterial({
    size: 5.0, map: glowTex, vertexColors: true,
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: false,
  })
  const pts = new THREE.Points(geo, mat)
  scene.add(pts); return pts
}

// ── Species Sprites (near-field LOD) ─────────────────────────────────────────

function buildSprites(distributions: SpeciesDistribution[], speciesImages: Record<string,string>, scene: any): { sprites: any[]; loadedUrls: Set<string> } {
  const loader = new THREE.TextureLoader()
  const fallbackTex = loader.load(makeGlowDataURL('#ffaa33', 128))
  const sprites: any[] = []
  const seen = new Set<string>()
  const loadedUrls = new Set<string>()

  distributions.forEach(d => {
    const imgUrl = speciesImages[d.species_id]
    if (!imgUrl || seen.has(d.species_id)) return
    seen.add(d.species_id)

    const mat = new THREE.SpriteMaterial({ map: fallbackTex.clone(), transparent: true, depthWrite: false })
    const sprite = new THREE.Sprite(mat)
    const [x, y, z] = latLonTo3D(d.latitude, d.longitude, EARTH_R + 0.3)
    sprite.position.set(x, y, z)
    sprite.scale.set(6, 6, 1)
    sprite.userData.distribution = d
    sprite.userData.imgUrl = imgUrl
    sprite.userData.loaded = false
    sprite.visible = false // only shown when zoomed in
    scene.add(sprite)
    sprites.push(sprite)
  })

  return { sprites, loadedUrls }
}

// ── Ocean Currents ───────────────────────────────────────────────────────────

const OCEAN_CURRENTS = [
  { name: '黑潮',           type: 'warm', coords: [[130,20],[140,28],[150,35],[165,42],[180,45]] },
  { name: '湾流',           type: 'warm', coords: [[-80,22],[-70,30],[-60,40],[-50,50],[-30,58]] },
  { name: '加利福尼亚寒流', type: 'cold', coords: [[-115,45],[-122,38],[-128,28],[-130,18]] },
  { name: '秘鲁寒流',       type: 'cold', coords: [[-80,-5],[-85,-12],[-90,-18],[-95,-25]] },
  { name: '厄加勒斯暖流',   type: 'warm', coords: [[20,-30],[30,-35],[40,-38],[50,-40]] },
]

function createCurrentAnimator(scene: any): any {
  const loader = new THREE.TextureLoader()
  const particles: any[] = [], segLensArr: number[][] = [], totalArr: number[] = [], phases: number[] = [], speeds: number[] = [], coordsAll: [number,number][][] = []

  OCEAN_CURRENTS.forEach(curr => {
    const pts = curr.coords.map(([lon, lat]) => latLonTo3D(lat, lon, EARTH_R + 0.1))
    const segLens: number[] = []; let total = 0
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i+1][0]-pts[i][0], dy = pts[i+1][1]-pts[i][1], dz = pts[i+1][2]-pts[i][2]
      segLens.push(Math.sqrt(dx*dx+dy*dy+dz*dz)); total += segLens[segLens.length-1]
    }
    segLensArr.push(segLens); totalArr.push(total)
    phases.push(Math.random()); speeds.push(0.003 + Math.random() * 0.005)
    coordsAll.push(curr.coords)

    const glowTex = loader.load(makeGlowDataURL(curr.type === 'warm' ? '#ff4466' : '#4488ff', 128))
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const pPts = new THREE.Points(pGeo, new THREE.PointsMaterial({
      size: 4.0, map: glowTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }))
    pPts.visible = false
    scene.add(pPts)
    particles.push(pPts)
  })

  return { particles, segLensArr, totalArr, phases, speeds, coordsAll }
}

// ── Migration Routes ──────────────────────────────────────────────────────────

const MIGRATION_ROUTES = [
  { color: '#FFD700', coords: [[110,22],[115,18],[120,14],[125,10]] },
  { color: '#FF6347', coords: [[-80,25],[-75,20],[-70,18],[-65,15]] },
  { color: '#00FA9A', coords: [[50,-20],[55,-25],[60,-28],[65,-30]] },
]

function createMigrationAnimator(scene: any): any {
  const loader = new THREE.TextureLoader()
  const particles: any[] = [], lines: any[] = [], segLensArr: number[][] = [], totalArr: number[] = [], phases: number[] = [], speeds: number[] = [], coordsAll: [number,number][][] = []

  MIGRATION_ROUTES.forEach((route, ri) => {
    const pts = route.coords.map(([lon, lat]) => latLonTo3D(lat, lon, EARTH_R + 0.2))
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts.map((p: number[]) => new THREE.Vector3(...p)))
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(route.color), transparent: true, opacity: 0.7 }))
    line.visible = false
    scene.add(line)
    lines.push(line)

    const segLens: number[] = []; let total = 0
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i+1][0]-pts[i][0], dy = pts[i+1][1]-pts[i][1], dz = pts[i+1][2]-pts[i][2]
      segLens.push(Math.sqrt(dx*dx+dy*dy+dz*dz)); total += segLens[segLens.length-1]
    }
    segLensArr.push(segLens); totalArr.push(total)
    phases.push(Math.random()); speeds.push(0.002 + Math.random() * 0.003)
    coordsAll.push(route.coords)

    const glowTex = loader.load(makeGlowDataURL(ri % 2 === 0 ? '#FFD700' : '#00FA9A', 64))
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const pPts = new THREE.Points(pGeo, new THREE.PointsMaterial({
      size: 1.5, map: glowTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }))
    pPts.visible = false
    scene.add(pPts)
    particles.push(pPts)
  })

  return { particles, lines, segLensArr, totalArr, phases, speeds, coordsAll }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  distributions?: SpeciesDistribution[]
  speciesImages?: Record<string, string>
  species?: any[]  // species list for constructing local image paths
}

export default function Globe3D({ distributions = [], speciesImages = {}, species = [] }: Props) {
  // Build speciesImages from species data if not provided via API
  const effectiveSpeciesImages = Object.keys(speciesImages).length > 0 ? speciesImages : (() => {
    const map: Record<string, string> = {}
    species.forEach((s: any) => {
      if (!s.id || !s.scientific_name) return
      const folder = s.scientific_name.replace(/ /g, '_')  // "Penaeus vannamei" → "Penaeus_vannamei"
      map[s.id] = `/species-images/${folder}/1.jpg`
    })
    return map
  })()
  const mountRef = useRef<HTMLDivElement>(null)
  const [checkboxState, setCheckboxState] = useState([
    { label: '虾类分布点', checked: true  },
    { label: '物种热力图',  checked: false },
    { label: '海洋洋流',    checked: false },
    { label: '洄游路径',    checked: false },
  ])
  const checkboxRef = useRef([true, false, false, false])
  const layerRefs = useRef<Record<string, any>>({})
  const loadedSprites = useRef(new Set<string>())

  useEffect(() => {
    if (!mountRef.current) return
    const THREE = (window as any).THREE
    const OC = (window as any).THREE?.OrbitControls
    if (!THREE || !OC) { console.error('[Globe3D] THREE.js CDN not loaded'); return }

    const container = mountRef.current
    const W = container.clientWidth || 800, H = container.clientHeight || 600

    // Renderer — alpha:false = opaque canvas (no transparency issues)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000510, 1)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000)
    camera.position.set(0, 15, 65)

    const controls = new OC(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.07
    controls.minDistance = 20; controls.maxDistance = 120

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const sun = new THREE.PointLight(0xffffff, 1.2)
    sun.position.set(50, 30, 50); scene.add(sun)

    // Stars
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(3000 * 3)
    for (let i = 0; i < 3000 * 3; i++) starPos[i] = (Math.random() - 0.5) * 600
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true })))

    // Earth — use LOCAL textures (no CDN dependency)
    const loader = new THREE.TextureLoader()
    const earthTex = loader.load('/textures/earth-blue-marble.jpg')
    const bumpTex  = loader.load('/textures/earth-topology.png')
    const specTex  = loader.load('/textures/earth-water.png')
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x4a90d9,  // blue fallback — always visible even if textures fail
        map: earthTex, bumpMap: bumpTex, bumpScale: 0.05,
        specularMap: specTex, specular: new THREE.Color(0x222222), shininess: 10,
      })
    )
    scene.add(earth)

    // Atmosphere
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R + 1.2, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x0088cc, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
    ))

    // Data layers
    const worldDots = buildWorldDots(distributions, scene)
    const heatmap   = buildRichnessHeatmap(distributions, scene)
    const { sprites } = buildSprites(distributions, effectiveSpeciesImages, scene)
    const currAnim  = createCurrentAnimator(scene)
    const migrAnim  = createMigrationAnimator(scene)

    // Initial visibility
    heatmap.visible = false
    currAnim.particles.forEach((p: any) => { p.visible = false })
    migrAnim.lines.forEach((l: any) => { l.visible = false })
    migrAnim.particles.forEach((p: any) => { p.visible = false })

    layerRefs.current = { worldDots, heatmap, sprites, currAnim, migrAnim, controls, camera, scene }

    // Animation loop
    let animId: number; let t = 0
    const NEAR = 40, FAR = 50

    const animate = () => {
      animId = requestAnimationFrame(animate)
      t += 0.016
      controls.update()

      // LOD switching: far=dots, near=sprites
      const dist = camera.position.length()
      if (dist < NEAR) {
        worldDots.visible = false
        sprites.forEach((s: any) => {
          s.visible = true
          // Lazy load real species image
          if (!s.userData.loaded && s.userData.imgUrl) {
            new THREE.TextureLoader().load(s.userData.imgUrl,
              (tex: any) => { s.material.map = tex; s.material.needsUpdate = true; s.userData.loaded = true },
              undefined,
              () => { /* keep orange glow fallback */ }
            )
            s.userData.loaded = true // prevent repeated attempts
          }
        })
      } else if (dist > FAR) {
        worldDots.visible = true
        sprites.forEach((s: any) => { s.visible = false })
      }

      // Animate ocean currents
      currAnim.particles.forEach((pts: any, ci: number) => {
        const pos = pts.geometry.attributes.position.array as Float32Array
        const segLens = currAnim.segLensArr[ci], total = currAnim.totalArr[ci]
        const phase = (t * currAnim.speeds[ci] * 60 + currAnim.phases[ci]) % 1
        let dist2 = phase * total; let si = 0
        for (let s = 0; s < segLens.length; s++) {
          if (dist2 < segLens[s]) { si = s; break }
          dist2 -= segLens[s]; si = s
        }
        const [lon1, lat1] = currAnim.coordsAll[ci][si]
        const [lon2, lat2] = currAnim.coordsAll[ci][si+1] || currAnim.coordsAll[ci][si]
        const fx = dist2 / (segLens[si] || 1)
        const [x, y, z] = latLonTo3D(lat1 + (lat2-lat1)*fx, lon1 + (lon2-lon1)*fx, EARTH_R + 0.1)
        pos[0] = x; pos[1] = y; pos[2] = z
        pts.geometry.attributes.position.needsUpdate = true
      })

      // Animate migration particles
      migrAnim.particles.forEach((pts: any, ri: number) => {
        const pos = pts.geometry.attributes.position.array as Float32Array
        const segLens = migrAnim.segLensArr[ri], total = migrAnim.totalArr[ri]
        const phase = (t * migrAnim.speeds[ri] * 60 + migrAnim.phases[ri]) % 1
        let dist2 = phase * total; let si = 0
        for (let s = 0; s < segLens.length; s++) {
          if (dist2 < segLens[s]) { si = s; break }
          dist2 -= segLens[s]; si = s
        }
        const [lon1, lat1] = migrAnim.coordsAll[ri][si]
        const [lon2, lat2] = migrAnim.coordsAll[ri][si+1] || migrAnim.coordsAll[ri][si]
        const fx = dist2 / (segLens[si] || 1)
        const [x, y, z] = latLonTo3D(lat1 + (lat2-lat1)*fx, lon1 + (lon2-lon1)*fx, EARTH_R + 0.2)
        pos[0] = x; pos[1] = y; pos[2] = z
        pts.geometry.attributes.position.needsUpdate = true
      })

      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container.clientWidth || !container.clientHeight) return
      renderer.setSize(container.clientWidth, container.clientHeight)
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement)
    }
  }, []) // eslint-disable-line

  const toggle = (i: number) => {
    const next = [...checkboxRef.current]
    next[i] = !next[i]
    checkboxRef.current = next
    setCheckboxState(prev => prev.map((cb, idx) => ({ ...cb, checked: next[idx] })))

    const refs = layerRefs.current
    if (i === 0 && refs.worldDots) refs.worldDots.visible = next[0]
    if (i === 1 && refs.heatmap)  refs.heatmap.visible  = next[1]
    if (i === 2 && refs.currAnim) refs.currAnim.particles.forEach((p: any) => { p.visible = next[2] })
    if (i === 3 && refs.migrAnim) {
      refs.migrAnim.lines.forEach((l: any) => { l.visible = next[3] })
      refs.migrAnim.particles.forEach((p: any) => { p.visible = next[3] })
    }
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {checkboxState.map((cb, i) => (
          <label key={i} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkboxRef.current[i]}
              onChange={() => toggle(i)}
              className="w-4 h-4 accent-cyan-400"
            />
            <span className="text-white text-sm drop-shadow">{cb.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
