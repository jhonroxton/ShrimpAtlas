// @ts-nocheck
/**
 * Globe3D.tsx — Three.js Earth Globe
 * Features: Distribution dots, Species sprites, Ocean currents, Click→Fly-to→Card
 *
 * Layer toggles (top-right): 分布点 / 物种图片 / 海洋洋流
 * Click dot or sprite → camera flies to region → earth shrinks left → card slides in
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import * as TWEEN from '@tweenjs/tween.js'
import type { SpeciesDistribution } from '../types/shrimp'

const EARTH_R = 20

// ── Math helpers ─────────────────────────────────────────────────────────────

function latLonToVec3(lat: number, lon: number, r = EARTH_R): [number, number, number] {
  const phi = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ]
}

// ── Glow texture (data URL) ─────────────────────────────────────────────────

function makeGlowDataURL(color: string, size = 128): string {
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

// ── Ocean Currents ────────────────────────────────────────────────────────────

const OCEAN_CURRENTS = [
  { name: '黑潮',           type: 'warm', coords: [[130,20],[140,28],[150,35],[165,42],[180,45]] },
  { name: '湾流',           type: 'warm', coords: [[-80,22],[-70,30],[-60,40],[-50,50],[-30,58]] },
  { name: '加利福尼亚寒流', type: 'cold', coords: [[-115,45],[-122,38],[-128,28],[-130,18]] },
  { name: '秘鲁寒流',       type: 'cold', coords: [[-80,-5],[-85,-12],[-90,-18],[-95,-25]] },
  { name: '厄加勒斯暖流',   type: 'warm', coords: [[20,-30],[30,-35],[40,-38],[50,-40]] },
]

// ── Species Card (React overlay) ─────────────────────────────────────────────

const IUCN_COLORS: Record<string, string> = {
  LC: '#7FD17F', NT: '#A8D17F', VU: '#FFD700', EN: '#FFA500',
  CR: '#FF4444', EW: '#FF88FF', EX: '#888888', DD: '#AAAAAA',
}
const IUCN_LABELS: Record<string, string> = {
  LC: '无危', NT: '近危', VU: '易危', EN: '濒危',
  CR: '极危', EW: '野外灭绝', EX: '灭绝', DD: '数据缺乏',
}
const ZONE_EMOJI: Record<string, string> = { tropical: '🌴', temperate: '🍂', cold: '❄️' }
const ZONE_LABEL: Record<string, string> = { tropical: '热带', temperate: '温带', cold: '寒带' }

interface CardData {
  id: string; cn_name: string; en_name: string
  scientific_name: string; scientificName?: string
  iucn_status: string; max_length_cm: number; diet: string
  is_edible: boolean; habitat: string; temperature_zone: string
  images: string[]; family: string; genus: string
}

function SpeciesCardPanel({ data, onClose }: { data: CardData; onClose: () => void }) {
  const [imgError, setImgError] = useState(false)
  const iucnColor = IUCN_COLORS[data.iucn_status] || '#AAAAAA'
  const sciName = data.scientific_name || data.scientificName || '—'
  const cnName = data.cn_name || data.en_name || '—'
  const iucn = data.iucn_status ? `${data.iucn_status} (${IUCN_LABELS[data.iucn_status] || data.iucn_status})` : '—'
  const maxLen = data.max_length_cm ? `${data.max_length_cm} cm` : '—'
  const edible = data.is_edible ? '✅ 可食用' : '⚠️ 不可食用'

  return (
    <div style={{
      position: 'absolute', top: '50%', right: '5%', transform: 'translateY(-50%)',
      width: '320px', background: 'rgba(5,15,35,0.96)',
      border: '1.5px solid rgba(0,212,255,0.5)', borderRadius: '16px',
      padding: '20px', color: 'white',
      fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 30px rgba(0,212,255,0.12)',
      zIndex: 200,
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: '12px', right: '12px',
        background: 'rgba(255,255,255,0.1)', border: 'none',
        color: '#aaa', cursor: 'pointer', fontSize: '18px',
        lineHeight: 1, padding: '4px 8px', borderRadius: '6px',
      }}>✕</button>

      <div style={{ width: '100%', height: '160px', borderRadius: '10px', background: '#0a1a2e', marginBottom: '14px', overflow: 'hidden' }}>
        {!imgError && data.images?.[0] ? (
          <img src={data.images[0]} alt={cnName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '48px' }}>🦐</span>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFD700', marginBottom: '4px' }}>{cnName}</div>
        <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>{sciName}</div>
        <div style={{ fontSize: '11px', color: '#777' }}>{data.en_name || ''}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', marginBottom: '10px' }}>
        {[['保护状态', iucn, iucnColor], ['最大体长', maxLen, '#ddd'],
          ['温度带', `${ZONE_EMOJI[data.temperature_zone] || '🌍'} ${ZONE_LABEL[data.temperature_zone] || data.temperature_zone || '—'}`, '#ddd'],
          ['食性', data.diet ? data.diet.substring(0, 6) : '—', '#ddd']].map(([label, val, color], i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
            <span style={{ color: '#888' }}>{label}</span>
            <div style={{ color: color as string, marginTop: '2px' }}>{val as string}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>
        🌊 栖息地：<span style={{ color: '#ccc' }}>{data.habitat || '—'}</span>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {data.family && <span style={{ fontSize: '10px', background: 'rgba(0,212,255,0.15)', color: '#7FD1D1', padding: '3px 8px', borderRadius: '20px' }}>{data.family}</span>}
        {data.genus && <span style={{ fontSize: '10px', background: 'rgba(0,212,255,0.15)', color: '#7FD1D1', padding: '3px 8px', borderRadius: '20px' }}>{data.genus}</span>}
        <span style={{ fontSize: '10px', background: data.is_edible ? 'rgba(127,209,127,0.2)' : 'rgba(255,127,127,0.2)', color: data.is_edible ? '#7FD17F' : '#FF7F7F', padding: '3px 8px', borderRadius: '20px' }}>{edible}</span>
      </div>

      <a href={`/species/${data.id}`} style={{
        display: 'block', textAlign: 'center', background: 'rgba(0,212,255,0.9)', color: '#001020',
        fontWeight: 'bold', fontSize: '13px', padding: '10px', borderRadius: '10px', textDecoration: 'none',
      }}>查看详情 →</a>
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  distributions?: SpeciesDistribution[]
  species?: any[]
  speciesImages?: Record<string, string>
}

export default function Globe3D({ distributions = [], species = [], speciesImages = {} }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  // Layer toggles: 0=分布点 1=物种图片 2=洋流
  const [checkboxState, setCheckboxState] = useState([
    { label: '虾类分布点', checked: true  },
    { label: '物种图片',    checked: false },
    { label: '海洋洋流',    checked: true  },
  ])
  const checkboxRef = useRef([true, false, true])

  const [cardData, setCardData] = useState<CardData | null>(null)
  const [cardVisible, setCardVisible] = useState(false)

  // All Three.js refs in one stable object
  const threeRef = useRef<Record<string, any>>({
    scene: null, camera: null, renderer: null, controls: null,
    earthGroup: null,
    worldDots: null, spriteMarkers: [], currParticles: [],
    buildDone: false,
  })
  const speciesMap = useRef<Record<string, any>>({})
  const distRef = useRef<SpeciesDistribution[]>([])
  const speciesDistMap = useRef<Record<string, SpeciesDistribution>>({})

  // Update species lookup whenever species prop changes
  useEffect(() => {
    species.forEach((s: any) => { speciesMap.current[s.id] = s })
  }, [species])

  // Toggle layer visibility
  const toggle = useCallback((i: number) => {
    const next = [...checkboxRef.current]
    next[i] = !next[i]
    checkboxRef.current = next
    setCheckboxState(prev => prev.map((cb, idx) => ({ ...cb, checked: next[idx] })))

    const r = threeRef.current
    if (i === 0 && r.worldDots)   r.worldDots.visible = next[0]
    if (i === 1) {
      r.spriteMarkers.forEach((s: any) => { s.visible = next[1] })
    }
    if (i === 2) {
      r.currParticles.forEach((p: any) => { p.visible = next[2] })
    }
  }, [])

  // Dismiss card + reset globe
  const dismissCard = useCallback(() => {
    const r = threeRef.current
    if (!r.scene || !r.camera || !r.controls) return

    if (r.earthGroup) {
      new TWEEN.Tween(r.earthGroup.scale)
        .to({ x: 1, y: 1, z: 1 }, 600).easing(TWEEN.Easing.Cubic.InOut).start()
      new TWEEN.Tween(r.earthGroup.position)
        .to({ x: 0, y: 0, z: 0 }, 600).easing(TWEEN.Easing.Cubic.InOut).start()
    }

    if (r.camera && r.controls) {
      new TWEEN.Tween(r.camera.position)
        .to({ x: 0, y: 15, z: 65 }, 700).easing(TWEEN.Easing.Cubic.InOut).start()
      new TWEEN.Tween(r.controls.target)
        .to({ x: 0, y: 0, z: 0 }, 700).easing(TWEEN.Easing.Cubic.InOut)
        .onUpdate(() => r.controls.update()).start()
    }

    setCardVisible(false)
    setTimeout(() => setCardData(null), 700)
  }, [])

  // Fly to region + show card
  const flyToRegionAndShowCard = useCallback((sp: any, dist: SpeciesDistribution) => {
    const r = threeRef.current
    if (!r.scene || !r.camera || !r.controls || !r.earthGroup) return

    const { camera, controls, earthGroup, scene } = r
    if (r.activeLabel) { scene.remove(r.activeLabel); r.activeLabel = null }

    const [tx, ty, tz] = latLonToVec3(dist.latitude, dist.longitude, EARTH_R)
    const len = Math.sqrt(tx*tx + ty*ty + tz*tz)
    const camDist = EARTH_R * 1.4
    const camEndX = (tx/len) * camDist, camEndY = (ty/len) * camDist, camEndZ = (tz/len) * camDist

    // Phase 1 — Camera fly (1.6 s)
    new TWEEN.Tween(camera.position)
      .to({ x: camEndX, y: camEndY, z: camEndZ }, 1600).easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => controls.update()).start()
    new TWEEN.Tween(controls.target)
      .to({ x: tx, y: ty, z: tz }, 1600).easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => controls.update()).start()

    // Phase 2 — Earth shrink + shift left (at t=1.3s)
    setTimeout(() => {
      if (!threeRef.current.earthGroup) return
      new TWEEN.Tween(earthGroup.scale).to({ x: 0.55, y: 0.55, z: 0.55 }, 900).easing(TWEEN.Easing.Cubic.InOut).start()
      new TWEEN.Tween(earthGroup.position).to({ x: -5.5, y: 0, z: 0 }, 900).easing(TWEEN.Easing.Cubic.InOut).start()
    }, 1300)

    // Phase 3 — Show card (at t=1.8s)
    setTimeout(() => {
      setCardData({
        id: sp.id,
        cn_name: sp.cn_name || sp.chinese_name || sp.en_name || '',
        en_name: sp.en_name || '',
        scientific_name: sp.scientific_name || '',
        iucn_status: sp.iucn_status || 'DD',
        max_length_cm: sp.max_length_cm || 0,
        diet: sp.diet || '',
        is_edible: !!sp.is_edible,
        habitat: sp.habitat || '—',
        temperature_zone: sp.temperature_zone || 'unknown',
        images: Array.isArray(sp.images) ? sp.images : (sp.images ? [sp.images] : []),
        family: sp.family || '',
        genus: sp.genus || '',
      })
      requestAnimationFrame(() => requestAnimationFrame(() => setCardVisible(true)))
    }, 1800)
  }, [])

  // ── Three.js Setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return

    const THREE = (window as any).THREE
    const OC = (window as any).THREE?.OrbitControls
    if (!THREE || !OC) { console.error('[Globe3D] THREE.js CDN not loaded'); return }

    const container = mountRef.current
    const W = container.clientWidth || 800, H = container.clientHeight || 600

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000510, 1)
    container.appendChild(renderer.domElement)

    // Scene + Camera
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 2000)
    camera.position.set(0, 15, 65)

    // Earth group (all geo inside → unified shrink/translate)
    const earthGroup = new THREE.Group()
    scene.add(earthGroup)

    // Orbit controls
    const controls = new OC(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.minDistance = 20
    controls.maxDistance = 120

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

    // Earth textures
    const loader = new THREE.TextureLoader()
    const earthTex = loader.load('/textures/earth-blue-marble.jpg')
    const bumpTex  = loader.load('/textures/earth-topology.png')
    const specTex  = loader.load('/textures/earth-water.png')

    // Earth mesh
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x4a90d9, map: earthTex, bumpMap: bumpTex,
        bumpScale: 0.05, specularMap: specTex,
        specular: new THREE.Color(0x222222), shininess: 10,
      })
    )
    earthGroup.add(earthMesh)

    // Atmosphere
    earthGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R + 1.2, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x0088cc, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
    ))

    // ── Ocean Currents ──────────────────────────────────────────────────────
    const currParticles: any[] = []
    OCEAN_CURRENTS.forEach(curr => {
      const pts = curr.coords.map(([lon, lat]) => latLonToVec3(lat, lon, EARTH_R + 0.1))
      const segLens: number[] = []; let total = 0
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i+1][0]-pts[i][0], dy = pts[i+1][1]-pts[i][1], dz = pts[i+1][2]-pts[i][2]
        segLens.push(Math.sqrt(dx*dx+dy*dy+dz*dz)); total += segLens[segLens.length-1]
      }
      const glowTex = loader.load(makeGlowDataURL(curr.type === 'warm' ? '#ff4466' : '#4488ff', 128))
      const pGeo = new THREE.BufferGeometry()
      pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
      const pPts = new THREE.Points(pGeo, new THREE.PointsMaterial({
        size: 4.0, map: glowTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, sizeAttenuation: true,
      }))
      pPts.visible = checkboxRef.current[2]
      pPts.userData = { curr, segLens, total, phase: Math.random(), speed: 0.003 + Math.random() * 0.005 }
      earthGroup.add(pPts)
      currParticles.push(pPts)
    })

    // ── Distribution dots (PointsMaterial, one per species) ───────────────
    let worldDots: any = null

    // ── Species sprites ─────────────────────────────────────────────────────
    let spriteMarkers: any[] = []

    const buildDataLayers = (distList: SpeciesDistribution[]) => {
      if (!distList || distList.length === 0) return
      distRef.current = distList

      // Remove old layers FIRST
      if (worldDots) { earthGroup.remove(worldDots); worldDots.geometry.dispose(); worldDots = null }
      spriteMarkers.forEach(s => earthGroup.remove(s))
      spriteMarkers = []

      // Build species lookup for sprites
      speciesDistMap.current = {}
      species.forEach((s: any) => { speciesMap.current[s.id] = s })

      // ── Distribution dots: one per unique species ───────────────────────
      const seen = new Set<string>()
      const positions: number[] = [], colors: number[] = [], distIndices: number[] = []
      distList.forEach((d: any, idx: number) => {
        if (seen.has(d.species_id)) return
        seen.add(d.species_id)
        distIndices.push(idx)
        speciesDistMap.current[d.species_id] = d
        const [x, y, z] = latLonToVec3(d.latitude, d.longitude, EARTH_R + 0.5)
        positions.push(x, y, z); colors.push(0.0, 0.83, 1.0)
      })

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
      geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(colors), 3))
      ;(geo as any)._distIndices = distIndices

      const glowTex = loader.load(makeGlowDataURL('#00D4FF', 128))
      worldDots = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 9.0, map: glowTex, vertexColors: true,
        transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, sizeAttenuation: true,
      }))
      worldDots.visible = checkboxRef.current[0]
      earthGroup.add(worldDots)

      // ── Species sprites ─────────────────────────────────────────────────
      seen.clear()
      distList.forEach((d: any) => {
        if (seen.has(d.species_id)) return
        seen.add(d.species_id)
        const sp = speciesMap.current[d.species_id]
        const imgUrl = (sp && sp.images && sp.images[0]) ? sp.images[0] : null

        const fallbackTex = loader.load(makeGlowDataURL('#FF8C00', 128))
        const mat = new THREE.SpriteMaterial({ map: fallbackTex, transparent: true, depthWrite: false })
        const sprite = new THREE.Sprite(mat)
        const [x, y, z] = latLonToVec3(d.latitude, d.longitude, EARTH_R + 0.3)
        sprite.position.set(x, y, z)
        sprite.scale.set(4, 4, 1)
        sprite.visible = false
        sprite.userData = { species_id: d.species_id, imgUrl, loaded: false }
        earthGroup.add(sprite)
        spriteMarkers.push(sprite)
      })

      // Store back into ref
      threeRef.current.worldDots = worldDots
      threeRef.current.spriteMarkers = spriteMarkers
      threeRef.current.buildDone = true
    }

    // Build immediately if data already loaded
    if (distributions.length > 0) buildDataLayers(distributions)
    species.forEach((s: any) => { speciesMap.current[s.id] = s })

    // ── Raycaster ──────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onMouseClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      // Check sprites first (near-field, on top when visible)
      const spriteHits = raycaster.intersectObjects(spriteMarkers, false)
      if (spriteHits.length > 0 && spriteHits[0].object.visible) {
        const sprite = spriteHits[0].object as any
        const sp = speciesMap.current[sprite.userData.species_id]
        const dist = speciesDistMap.current[sprite.userData.species_id]
        if (!sp || !dist) return
        dismissCard()
        setTimeout(() => flyToRegionAndShowCard(sp, dist), 50)
        return
      }

      // Check distribution dots (far-field)
      if (worldDots) {
        const dotHits = raycaster.intersectObject(worldDots)
        if (dotHits.length > 0) {
          const ptIdx = dotHits[0].index
          if (ptIdx !== undefined) {
            const distIdx = (worldDots.geometry as any)._distIndices?.[ptIdx]
            if (distIdx !== undefined) {
              const d = distRef.current[distIdx]
              const sp = speciesMap.current[d?.species_id]
              if (!sp) return
              dismissCard()
              setTimeout(() => flyToRegionAndShowCard(sp, d), 50)
              return
            }
          }
        }
      }
    }
    renderer.domElement.addEventListener('click', onMouseClick)

    // Store Three.js refs
    threeRef.current = {
      scene, camera, renderer, controls, earthGroup,
      worldDots, spriteMarkers, currParticles,
      buildDataLayers, buildDone: !!distributions.length,
      activeLabel: null,
    }
    ;(window as any).__globe = threeRef.current

    // ── Animation loop ────────────────────────────────────────────────────
    let animId: number; let t = 0
    const animate = (time: number) => {
      animId = requestAnimationFrame(animate)
      t += 0.016
      TWEEN.update(time)
      controls.update()

      const dist = camera.position.length()

      // LOD: show sprites when close
      if (worldDots) {
        const showSprites = dist < 42
        worldDots.visible = !showSprites && checkboxRef.current[0]
        spriteMarkers.forEach(s => {
          s.visible = (showSprites || checkboxRef.current[1])
        })

        // Lazy-load species real images when sprites visible
        if (showSprites || checkboxRef.current[1]) {
          spriteMarkers.forEach((sprite: any) => {
            if (!sprite.userData.loaded && sprite.userData.imgUrl) {
              new THREE.TextureLoader().load(
                sprite.userData.imgUrl,
                (tex: any) => { sprite.material.map = tex; sprite.material.needsUpdate = true; sprite.userData.loaded = true },
                undefined, () => {}
              )
              sprite.userData.loaded = true
            }
          })
        }
      }

      // Animate ocean current particles
      currParticles.forEach((pts: any) => {
        const { curr, segLens, total, phase, speed } = pts.userData
        const pos = pts.geometry.attributes.position.array as Float32Array
        const p = (t * speed * 60 + phase) % 1
        let dist2 = p * total; let si = 0
        for (let s = 0; s < segLens.length; s++) {
          if (dist2 < segLens[s]) { si = s; break }
          dist2 -= segLens[s]; si = s
        }
        const [lon1, lat1] = curr.coords[si]
        const [lon2, lat2] = curr.coords[si+1] || curr.coords[si]
        const fx = dist2 / (segLens[si] || 1)
        const [x, y, z] = latLonToVec3(lat1 + (lat2-lat1)*fx, lon1 + (lon2-lon1)*fx, EARTH_R + 0.1)
        pos[0] = x; pos[1] = y; pos[2] = z
        pts.geometry.attributes.position.needsUpdate = true
      })

      renderer.render(scene, camera)
    }
    animate(0)

    const onResize = () => {
      if (!container.clientWidth || !container.clientHeight) return
      renderer.setSize(container.clientWidth, container.clientHeight)
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('click', onMouseClick)
      renderer.dispose()
      if (mountRef.current && renderer.domElement.parentNode) {
        mountRef.current.removeChild(renderer.domElement)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build layers when distributions + species both arrive
  useEffect(() => {
    const r = threeRef.current
    if (!r.scene || distributions.length === 0) return
    species.forEach((s: any) => { speciesMap.current[s.id] = s })
    if (r.buildDataLayers) {
      distRef.current = distributions
      r.buildDataLayers(distributions)
    }
  }, [distributions, species.length]) // eslint-disable-line

  return (
    <div className="relative w-full h-full" style={{ overflow: 'hidden' }}>
      <div ref={mountRef} className="w-full h-full" />

      {/* Sliding species card */}
      <div style={{
        position: 'absolute', inset: 0,
        pointerEvents: cardVisible ? 'auto' : 'none',
        zIndex: 150,
        transform: cardVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.75s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {cardData && <SpeciesCardPanel data={cardData} onClose={dismissCard} />}
      </div>

      {/* Layer toggles */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        {checkboxState.map((cb, i) => (
          <label key={i} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkboxRef.current[i]}
              onChange={() => toggle(i)}
              className="w-4 h-4 accent-cyan-400"
            />
            <span className="text-white text-sm drop-shadow-lg" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{cb.label}</span>
          </label>
        ))}
        <div style={{
          background: 'rgba(0,10,25,0.75)', border: '1px solid rgba(0,212,255,0.25)',
          borderRadius: '8px', padding: '8px 12px',
          fontSize: '11px', color: '#aaa', backdropFilter: 'blur(6px)', lineHeight: '1.8',
        }}>
          🔵 点击光点 → 飞向区域 + 显示卡片<br/>
          ☀️ 滚轮缩放 · 拖拽旋转<br/>
          ✕ 卡片右上角关闭
        </div>
      </div>
    </div>
  )
}
