// @ts-nocheck
/**
 * Globe3D.tsx — Species cards densely displayed on the globe
 * - One card per species (2597 species) anchored at first distribution location
 * - HTML card elements with species photo + name, follow globe rotation
 * - Click card → fly to + show detail card
 * - Ocean currents animation
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import * as TWEEN from '@tweenjs/tween.js'
import type { SpeciesDistribution } from '../types/shrimp'

const EARTH_R = 20

function latLonToVec3(lat: number, lon: number, r = EARTH_R): [number, number, number] {
  const phi = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ]
}

function makeGlowDataURL(color: string, size = 128): string {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')!
  const cx = size / 2, cy = size / 2, rad = size * 0.42
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
  g.addColorStop(0, color); g.addColorStop(0.4, color + 'cc'); g.addColorStop(1, color + '00')
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

// ── Detail Card ───────────────────────────────────────────────────────────────

const IUCN_COLORS: Record<string, string> = {
  LC: '#7FD17F', NT: '#A8D17F', VU: '#FFD700', EN: '#FFA500',
  CR: '#FF4444', EW: '#FF88FF', EX: '#888888', DD: '#AAAAAA',
}
const IUCN_LABELS: Record<string, string> = {
  LC: '无危', NT: '近危', VU: '易危', EN: '濒危',
  CR: '极危', EW: '野外灭绝', EX: '灭绝', DD: '数据缺乏',
}

interface CardData {
  id: string; cn_name: string; en_name: string; scientific_name: string
  iucn_status: string; max_length_cm: number; diet: string
  is_edible: boolean; habitat: string; temperature_zone: string
  images: string[]; family: string; genus: string
}

function DetailCard({ data, onClose }: { data: CardData; onClose: () => void }) {
  const [imgError, setImgError] = useState(false)
  const iucnColor = IUCN_COLORS[data.iucn_status] || '#AAAAAA'
  const iucn = data.iucn_status ? `${data.iucn_status} (${IUCN_LABELS[data.iucn_status] || data.iucn_status})` : '—'
  const maxLen = data.max_length_cm ? `${data.max_length_cm} cm` : '—'
  const edible = data.is_edible ? '✅ 可食用' : '⚠️ 不可食用'
  const cnName = data.cn_name || data.en_name || '—'

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
        padding: '4px 8px', borderRadius: '6px',
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
        <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>{data.scientific_name || '—'}</div>
        <div style={{ fontSize: '11px', color: '#777' }}>{data.en_name || ''}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', marginBottom: '10px' }}>
        {[['保护状态', iucn, iucnColor], ['最大体长', maxLen, '#ddd'],
          ['温度带', data.temperature_zone || '—', '#ddd'],
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

// ── Globe card (shown on globe surface) ─────────────────────────────────────

function makeGlobeCardHTML(sp: any, imgUrl: string | null): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `
    width: 52px; height: 52px;
    border-radius: 8px;
    overflow: hidden;
    border: 1.5px solid rgba(0,212,255,0.6);
    cursor: pointer;
    background: #0a1a2e;
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    transition: transform 0.15s, border-color 0.15s;
    pointer-events: auto;
  `
  if (imgUrl) {
    el.innerHTML = `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;" />`
  } else {
    el.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">🦐</div>`
  }
  return el
}

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  distributions?: SpeciesDistribution[]
  species?: any[]
  speciesImages?: Record<string, string>
}

export default function Globe3D({ distributions = [], species = [], speciesImages = {} }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)

  const [detailCard, setDetailCard] = useState<CardData | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [showCurrents, setShowCurrents] = useState(true)

  const threeRef = useRef<Record<string, any>>({})
  const speciesMap = useRef<Record<string, any>>({})
  const distRef = useRef<SpeciesDistribution[]>([])

  useEffect(() => {
    species.forEach((s: any) => { speciesMap.current[s.id] = s })
  }, [species])

  // Dismiss detail card + reset globe
  const dismissDetail = useCallback(() => {
    const r = threeRef.current
    if (!r.scene || !r.camera || !r.controls) return
    if (r.earthGroup) {
      new TWEEN.Tween(r.earthGroup.scale).to({ x: 1, y: 1, z: 1 }, 600).easing(TWEEN.Easing.Cubic.InOut).start()
      new TWEEN.Tween(r.earthGroup.position).to({ x: 0, y: 0, z: 0 }, 600).easing(TWEEN.Easing.Cubic.InOut).start()
    }
    if (r.camera && r.controls) {
      new TWEEN.Tween(r.camera.position).to({ x: 0, y: 15, z: 65 }, 700).easing(TWEEN.Easing.Cubic.InOut).start()
      new TWEEN.Tween(r.controls.target).to({ x: 0, y: 0, z: 0 }, 700).easing(TWEEN.Easing.Cubic.InOut).onUpdate(() => r.controls.update()).start()
    }
    setDetailVisible(false)
    setTimeout(() => setDetailCard(null), 700)
  }, [])

  // Fly to species location + show detail card
  const flyToAndShow = useCallback((sp: any, dist: SpeciesDistribution) => {
    const r = threeRef.current
    if (!r.scene || !r.camera || !r.controls || !r.earthGroup) return
    const { camera, controls, earthGroup } = r

    const [tx, ty, tz] = latLonToVec3(dist.latitude, dist.longitude, EARTH_R)
    const len = Math.sqrt(tx*tx + ty*ty + tz*tz)
    const camDist = EARTH_R * 1.4
    const camEndX = (tx/len) * camDist, camEndY = (ty/len) * camDist, camEndZ = (tz/len) * camDist

    new TWEEN.Tween(camera.position).to({ x: camEndX, y: camEndY, z: camEndZ }, 1600).easing(TWEEN.Easing.Cubic.InOut).onUpdate(() => controls.update()).start()
    new TWEEN.Tween(controls.target).to({ x: tx, y: ty, z: tz }, 1600).easing(TWEEN.Easing.Cubic.InOut).onUpdate(() => controls.update()).start()

    setTimeout(() => {
      if (!threeRef.current.earthGroup) return
      new TWEEN.Tween(earthGroup.scale).to({ x: 0.55, y: 0.55, z: 0.55 }, 900).easing(TWEEN.Easing.Cubic.InOut).start()
      new TWEEN.Tween(earthGroup.position).to({ x: -5.5, y: 0, z: 0 }, 900).easing(TWEEN.Easing.Cubic.InOut).start()
    }, 1300)

    setTimeout(() => {
      setDetailCard({
        id: sp.id,
        cn_name: sp.cn_name || sp.en_name || '',
        en_name: sp.en_name || '',
        scientific_name: sp.scientific_name || '',
        iucn_status: sp.iucn_status || 'DD',
        max_length_cm: sp.max_length_cm || 0,
        diet: sp.diet || '',
        is_edible: !!sp.is_edible,
        habitat: sp.habitat || '—',
        temperature_zone: sp.temperature_zone || '—',
        images: Array.isArray(sp.images) ? sp.images : (sp.images ? [sp.images] : []),
        family: sp.family || '',
        genus: sp.genus || '',
      })
      requestAnimationFrame(() => requestAnimationFrame(() => setDetailVisible(true)))
    }, 1800)
  }, [])

  const toggleCurrents = useCallback(() => {
    const next = !showCurrents
    setShowCurrents(next)
    threeRef.current.currParticles?.forEach((p: any) => { p.visible = next })
  }, [showCurrents])

  // Build species → first distribution location map
  const buildSpeciesFirstDist = useCallback((distList: SpeciesDistribution[]) => {
    const map: Record<string, SpeciesDistribution> = {}
    distList.forEach(d => {
      if (!map[d.species_id]) map[d.species_id] = d
    })
    return map
  }, [])

  // ── Three.js Setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return

    const THREE = (window as any).THREE
    const OC = (window as any).THREE?.OrbitControls
    if (!THREE || !OC) { console.error('[Globe3D] THREE.js CDN not loaded'); return }

    const container = mountRef.current
    const W = container.clientWidth || 800, H = container.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000510, 1)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 2000)
    camera.position.set(0, 15, 65)

    const earthGroup = new THREE.Group()
    scene.add(earthGroup)

    // CSS2DRenderer for globe surface cards
    const labelRenderer = new CSS2DRenderer()
    if (labelRef.current) {
      labelRef.current.style.position = 'absolute'
      labelRef.current.style.top = '0'
      labelRef.current.style.left = '0'
      labelRef.current.style.pointerEvents = 'none'
      labelRef.current.style.width = '100%'
      labelRef.current.style.height = '100%'
      container.appendChild(labelRef.current)
      labelRenderer.domElement.style.position = 'absolute'
      labelRenderer.domElement.style.top = '0'
      labelRenderer.domElement.style.left = '0'
      labelRef.current.appendChild(labelRenderer.domElement)
    }

    const controls = new OC(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.minDistance = 20
    controls.maxDistance = 120

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const sun = new THREE.PointLight(0xffffff, 1.2)
    sun.position.set(50, 30, 50); scene.add(sun)

    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(3000 * 3)
    for (let i = 0; i < 3000 * 3; i++) starPos[i] = (Math.random() - 0.5) * 600
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true })))

    const loader = new THREE.TextureLoader()
    const earthTex = loader.load('/textures/earth-blue-marble.jpg')
    const bumpTex  = loader.load('/textures/earth-topology.png')
    const specTex  = loader.load('/textures/earth-water.png')

    earthGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x4a90d9, map: earthTex, bumpMap: bumpTex,
        bumpScale: 0.05, specularMap: specTex,
        specular: new THREE.Color(0x222222), shininess: 10,
      })
    ))

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
      const glowTex = loader.load(makeGlowDataURL(curr.type === 'warm' ? '#ff4466' : '#4488ff', 64))
      const pGeo = new THREE.BufferGeometry()
      pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
      const pPts = new THREE.Points(pGeo, new THREE.PointsMaterial({
        size: 4.0, map: glowTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, sizeAttenuation: true,
      }))
      pPts.visible = true
      pPts.userData = { curr, segLens, total, phase: Math.random(), speed: 0.003 + Math.random() * 0.005 }
      earthGroup.add(pPts)
      currParticles.push(pPts)
    })

    // ── Species Cards (CSS2DObjects on globe surface) ─────────────────────────
    // One card per unique species, anchored at its first distribution location
    const card2dObjects: CSS2DObject[] = []

    const buildCards = (distList: SpeciesDistribution[], speciesData: any[]) => {
      if (!distList || distList.length === 0) return
      distRef.current = distList
      speciesData.forEach((s: any) => { speciesMap.current[s.id] = s })

      // Remove old cards
      card2dObjects.forEach(o => scene.remove(o))
      card2dObjects.length = 0

      // Species → first distribution
      const speciesFirstDist: Record<string, SpeciesDistribution> = {}
      distList.forEach(d => {
        if (!speciesFirstDist[d.species_id]) speciesFirstDist[d.species_id] = d
      })

      // One card per species
      Object.entries(speciesFirstDist).forEach(([speciesId, dist]) => {
        const sp = speciesMap.current[speciesId]
        if (!sp) return

        const imgUrl = (sp.images && sp.images[0]) ? sp.images[0]
          : speciesImages[speciesId] || null

        const el = makeGlobeCardHTML(sp, imgUrl)
        const [x, y, z] = latLonToVec3(dist.latitude, dist.longitude, EARTH_R + 0.3)
        const pos = new THREE.Vector3(x, y, z)
        const obj = new CSS2DObject(el)
        obj.position.copy(pos)
        obj.userData = { speciesId, sp, dist }

        el.addEventListener('click', () => {
          dismissDetail()
          setTimeout(() => flyToAndShow(sp, dist), 50)
        })

        scene.add(obj)
        card2dObjects.push(obj)
      })
    }

    if (distributions.length > 0 && species.length > 0) buildCards(distributions, species)

    // Store refs
    threeRef.current = {
      scene, camera, renderer, controls, earthGroup,
      labelRenderer, card2dObjects,
      currParticles, buildCards,
      speciesFirstDist: {},
    }

    // ── Raycaster (for clicking CSS2DObjects via hidden mesh) ────────────────
    // Create invisible hit spheres at each card position for raycasting
    const hitMeshes: any[] = []
    const buildHitMeshes = () => {
      hitMeshes.forEach(m => scene.remove(m))
      hitMeshes.length = 0
      card2dObjects.forEach(obj => {
        const hitSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 6, 6),
          new THREE.MeshBasicMaterial({ visible: false })
        )
        hitSphere.position.copy(obj.position)
        hitSphere.userData = obj.userData
        scene.add(hitSphere)
        hitMeshes.push(hitSphere)
      })
    }

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onMouseClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      const hits = raycaster.intersectObjects(hitMeshes)
      if (hits.length > 0) {
        const { sp, dist } = hits[0].object.userData
        if (!sp) return
        dismissDetail()
        setTimeout(() => flyToAndShow(sp, dist), 50)
        return
      }
    }
    renderer.domElement.addEventListener('click', onMouseClick)

    // Build hit meshes after cards
    setTimeout(buildHitMeshes, 500)

    // ── Animation loop ────────────────────────────────────────────────────
    let animId: number; let t = 0
    const animate = (time: number) => {
      animId = requestAnimationFrame(animate)
      t += 0.016
      TWEEN.update(time)
      controls.update()

      // Animate ocean currents
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
      labelRenderer.render(scene, camera)
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

  // Build cards when both distributions + species data available
  useEffect(() => {
    const r = threeRef.current
    if (!r.scene || distributions.length === 0 || species.length === 0) return
    species.forEach((s: any) => { speciesMap.current[s.id] = s })
    if (r.buildCards) r.buildCards(distributions, species)
  }, [distributions, species.length]) // eslint-disable-line

  return (
    <div className="relative w-full h-full" style={{ overflow: 'hidden' }}>
      <div ref={mountRef} className="w-full h-full" />
      <div ref={labelRef} className="absolute inset-0" style={{ zIndex: 10 }} />

      {/* Detail card (slides in from right) */}
      <div style={{
        position: 'absolute', inset: 0,
        pointerEvents: detailVisible ? 'auto' : 'none',
        zIndex: 150,
        transform: detailVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.75s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {detailCard && <DetailCard data={detailCard} onClose={dismissDetail} />}
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 z-20">
        <div style={{
          background: 'rgba(0,10,25,0.80)',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: '10px', padding: '10px 14px',
          backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCurrents}
              onChange={toggleCurrents}
              className="w-4 h-4 accent-cyan-400"
            />
            <span className="text-white text-sm" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>🌊 海洋洋流</span>
          </label>
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '8px', fontSize: '11px', color: '#aaa', lineHeight: '1.8',
          }}>
            🦐 拖拽旋转地球查看物种卡片<br/>
            ☀️ 点击卡片 → 飞向区域 + 详情
          </div>
        </div>
      </div>
    </div>
  )
}
