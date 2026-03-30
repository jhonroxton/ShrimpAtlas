// @ts-nocheck
/**
 * Globe3Dv2.tsx — Three.js Earth Globe
 * Features: InstancedMesh dots, Sprite LOD, fly-to-region animation + sliding card
 *
 * Animation sequence (per Feishu doc):
 *   Stage 1 — Camera flies to target + OrbitControls.target follows
 *   Stage 2 — Earth shrinks + moves left
 *   Stage 3 — Species card slides in from right
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
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

// ── Species card content (pure React, no DOM creation) ─────────────────────

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
  id: string
  cn_name: string
  en_name: string
  scientific_name: string
  scientificName?: string  // some API shapes use this
  iucn_status: string
  max_length_cm: number
  diet: string
  is_edible: boolean
  habitat: string
  temperature_zone: string
  images: string[]
  family: string
  genus: string
}

function SpeciesCardPanel({ data, onClose }: { data: CardData; onClose: () => void }) {
  const [imgError, setImgError] = useState(false)
  const iucnColor = IUCN_COLORS[data.iucn_status] || '#AAAAAA'
  const sciName = data.scientific_name || data.scientificName || '—'
  const cnName = data.cn_name || data.en_name || '—'
  const habitat = data.habitat || '—'
  const diet = data.diet || '—'
  const iucn = data.iucn_status ? `${data.iucn_status} (${IUCN_LABELS[data.iucn_status] || data.iucn_status})` : '—'
  const maxLen = data.max_length_cm ? `${data.max_length_cm} cm` : '—'
  const edible = data.is_edible ? '✅ 可食用' : '⚠️ 不可食用'
  const zoneEmoji = ZONE_EMOJI[data.temperature_zone] || '🌍'
  const zoneLabel = ZONE_LABEL[data.temperature_zone] || data.temperature_zone || '—'

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      right: '5%',
      transform: 'translateY(-50%)',
      width: '320px',
      background: 'rgba(5,15,35,0.96)',
      border: '1.5px solid rgba(0,212,255,0.5)',
      borderRadius: '16px',
      padding: '20px',
      color: 'white',
      fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 30px rgba(0,212,255,0.12)',
      zIndex: 200,
      willChange: 'transform, opacity',
      transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1), opacity 0.6s ease',
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '12px', right: '12px',
          background: 'rgba(255,255,255,0.1)', border: 'none',
          color: '#aaa', cursor: 'pointer', fontSize: '18px',
          lineHeight: 1, padding: '4px 8px', borderRadius: '6px',
        }}
      >✕</button>

      {/* Image */}
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

      {/* Names */}
      <div style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFD700', marginBottom: '4px' }}>
          {cnName}
        </div>
        <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>{sciName}</div>
        <div style={{ fontSize: '11px', color: '#777' }}>{data.en_name || ''}</div>
      </div>

      {/* IUCN + Max Length */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', marginBottom: '10px' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
          <span style={{ color: '#888' }}>保护状态</span>
          <div style={{ color: iucnColor, fontWeight: 'bold', marginTop: '2px' }}>{iucn}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
          <span style={{ color: '#888' }}>最大体长</span>
          <div style={{ color: '#ddd', marginTop: '2px' }}>{maxLen}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
          <span style={{ color: '#888' }}>温度带</span>
          <div style={{ color: '#ddd', marginTop: '2px' }}>{zoneEmoji} {zoneLabel}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
          <span style={{ color: '#888' }}>食性</span>
          <div style={{ color: '#ddd', marginTop: '2px' }}>{diet ? diet.substring(0, 6) : '—'}</div>
        </div>
      </div>

      {/* Habitat */}
      <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>
        🌊 栖息地：<span style={{ color: '#ccc' }}>{habitat}</span>
      </div>

      {/* Classification tags */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {data.family && <span style={{ fontSize: '10px', background: 'rgba(0,212,255,0.15)', color: '#7FD1D1', padding: '3px 8px', borderRadius: '20px' }}>{data.family}</span>}
        {data.genus && <span style={{ fontSize: '10px', background: 'rgba(0,212,255,0.15)', color: '#7FD1D1', padding: '3px 8px', borderRadius: '20px' }}>{data.genus}</span>}
        <span style={{ fontSize: '10px', background: data.is_edible ? 'rgba(127,209,127,0.2)' : 'rgba(255,127,127,0.2)', color: data.is_edible ? '#7FD17F' : '#FF7F7F', padding: '3px 8px', borderRadius: '20px' }}>
          {edible}
        </span>
      </div>

      {/* View detail link */}
      <a
        href={`/species/${data.id}`}
        style={{
          display: 'block', textAlign: 'center',
          background: 'rgba(0,212,255,0.9)', color: '#001020',
          fontWeight: 'bold', fontSize: '13px',
          padding: '10px', borderRadius: '10px',
          textDecoration: 'none',
        }}
      >
        查看详情 →
      </a>
    </div>
  )
}

// ── Season config ────────────────────────────────────────────────────────────

const SEASONS: Record<string, { label: string; earthColor: number }> = {
  spring: { label: '🌸 春季', earthColor: 0xffffff },
  summer: { label: '☀️ 夏季', earthColor: 0xffffff },
  autumn: { label: '🍂 秋季', earthColor: 0xffffff },
  winter: { label: '❄️ 冬季', earthColor: 0xd0e8f0 },
}

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  distributions?: SpeciesDistribution[]
  species?: any[]
  speciesImages?: Record<string, string>
}

export default function Globe3D({ distributions = [], species = [], speciesImages = {} }: Props) {
  const mountRef   = useRef<HTMLDivElement>(null)
  const labelRef   = useRef<HTMLDivElement>(null)
  const [season, setSeason] = useState<Season>({ key: 'spring', label: '🌸 春季' })
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [cardVisible, setCardVisible] = useState(false)
  const stateRef = useRef<Record<string, any>>({})
  const speciesMap = useRef<Record<string, any>>({})
  const distRef = useRef<SpeciesDistribution[]>([])
  const speciesDistMap = useRef<Record<string, SpeciesDistribution>>({})

  // Build species lookup map
  useEffect(() => {
    species.forEach((s: any) => { speciesMap.current[s.id] = s })
  }, [species])

  // Dismiss card and reset globe
  const dismissCard = useCallback(() => {
    const sr = stateRef.current
    if (!sr.scene) return

    // Remove 3D label if present
    if (sr.activeLabelObj) {
      sr.scene.remove(sr.activeLabelObj)
      sr.activeLabelObj = null
    }

    // Animate earth back to original
    const { earthGroup, camera, controls } = sr
    if (earthGroup) {
      new TWEEN.Tween(earthGroup.scale)
        .to({ x: 1, y: 1, z: 1 }, 600)
        .easing(TWEEN.Easing.Cubic.InOut)
        .start()
      new TWEEN.Tween(earthGroup.position)
        .to({ x: 0, y: 0, z: 0 }, 600)
        .easing(TWEEN.Easing.Cubic.InOut)
        .start()
    }

    // Fly camera back to default
    if (camera && controls) {
      new TWEEN.Tween(camera.position)
        .to({ x: 0, y: 15, z: 65 }, 700)
        .easing(TWEEN.Easing.Cubic.InOut)
        .start()
      new TWEEN.Tween(controls.target)
        .to({ x: 0, y: 0, z: 0 }, 700)
        .easing(TWEEN.Easing.Cubic.InOut)
        .onUpdate(() => controls.update())
        .start()
    }

    setCardVisible(false)
    setTimeout(() => setCardData(null), 700)
  }, [])

  // Core animation: fly to region + shrink earth + show card
  const flyToRegionAndShowCard = useCallback((sp: any, dist: SpeciesDistribution) => {
    const sr = stateRef.current
    if (!sr.scene || !sr.camera || !sr.controls || !sr.earthGroup) return

    const { camera, controls, earthGroup, scene } = sr

    // Remove existing label
    if (sr.activeLabelObj) { scene.remove(sr.activeLabelObj); sr.activeLabelObj = null }

    // Target 3D position
    const [tx, ty, tz] = latLonToVec3(dist.latitude, dist.longitude, EARTH_R)

    // Camera end position: extend from target toward camera direction by a fixed distance
    // Direction from earth center to target
    const dirX = tx, dirY = ty, dirZ = tz
    const len = Math.sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ)
    const normX = dirX/len, normY = dirY/len, normZ = dirZ/len
    // Pull back from target: final camera distance from earth center ~ EARTH_R * 1.4
    const camDist = EARTH_R * 1.4
    const camEndX = normX * camDist
    const camEndY = normY * camDist
    const camEndZ = normZ * camDist

    // Phase 1 — Camera fly (1.6 s)
    new TWEEN.Tween(camera.position)
      .to({ x: camEndX, y: camEndY, z: camEndZ }, 1600)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => controls.update())
      .start()

    new TWEEN.Tween(controls.target)
      .to({ x: tx, y: ty, z: tz }, 1600)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => controls.update())
      .start()

    // Phase 2 — Earth shrink + shift left (starts at t=1.3s, lasts 0.9s)
    setTimeout(() => {
      if (!stateRef.current.earthGroup) return
      new TWEEN.Tween(earthGroup.scale)
        .to({ x: 0.55, y: 0.55, z: 0.55 }, 900)
        .easing(TWEEN.Easing.Cubic.InOut)
        .start()
      new TWEEN.Tween(earthGroup.position)
        .to({ x: -5.5, y: 0, z: 0 }, 900)
        .easing(TWEEN.Easing.Cubic.InOut)
        .start()
    }, 1300)

    // Phase 3 — Show card (starts at t=1.8s)
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
      // Trigger slide-in: start from translateX(100%) then animate to translateX(0)
      requestAnimationFrame(() => requestAnimationFrame(() => setCardVisible(true)))
    }, 1800)
  }, [])

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

    // Earth group (for animated shrink/translate)
    const earthGroup = new THREE.Group()
    scene.add(earthGroup)

    // CSS2DRenderer (for 3D-attached labels, not used for main card)
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

    // Orbit controls
    const controls = new OC(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.minDistance = 20
    controls.maxDistance = 120

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const sun = new THREE.PointLight(0xffffff, 1.2)
    sun.position.set(50, 30, 50)
    scene.add(sun)

    // Stars
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(3000 * 3)
    for (let i = 0; i < 3000 * 3; i++) starPos[i] = (Math.random() - 0.5) * 600
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true })))

    // Earth textures → added to earthGroup (not scene directly)
    const loader = new THREE.TextureLoader()
    const earthTex = loader.load('/textures/earth-blue-marble.jpg')
    const bumpTex  = loader.load('/textures/earth-topology.png')
    const specTex  = loader.load('/textures/earth-water.png')
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x4a90d9, map: earthTex, bumpMap: bumpTex,
        bumpScale: 0.05, specularMap: specTex,
        specular: new THREE.Color(0x222222), shininess: 10,
      })
    )
    earthGroup.add(earthMesh)

    // Atmosphere (also in earthGroup so it shrinks too)
    earthGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R + 1.2, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x0088cc, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
    ))

    // ── InstancedMesh for distribution dots ─────────────────────────────────
    let instancedMarkers: any = null
    let dotTempObj = new THREE.Object3D()

    // ── Species sprite images (near-field LOD) ─────────────────────────────
    let spriteMarkers: any[] = []

    const buildMarkers = (distList: SpeciesDistribution[]) => {
      if (!distList || distList.length === 0) return
      distRef.current = distList

      // Remove old
      if (instancedMarkers) { scene.remove(instancedMarkers); instancedMarkers.geometry.dispose(); instancedMarkers = null }
      spriteMarkers.forEach(s => scene.remove(s))
      spriteMarkers = []

      // Far-field: InstancedMesh dots
      const n = distList.length
      const dotGeo = new THREE.SphereGeometry(0.12, 6, 6)
      const dotTex = loader.load(makeGlowDataURL('#00D4FF', 128))
      const dotMat = new THREE.MeshBasicMaterial({ map: dotTex, transparent: true })
      instancedMarkers = new THREE.InstancedMesh(dotGeo, dotMat, n)
      instancedMarkers.instanceMatrix.setUsage(THREE.StaticDrawUsage)

      distList.forEach((d, i) => {
        const [x, y, z] = latLonToVec3(d.latitude, d.longitude, EARTH_R + 0.05)
        dotTempObj.position.set(x, y, z)
        dotTempObj.updateMatrix()
        instancedMarkers.setMatrixAt(i, dotTempObj.matrix)
      })
      instancedMarkers.instanceMatrix.needsUpdate = true
      // Dots are in earthGroup → they also shrink/translate with earth
      earthGroup.add(instancedMarkers)

      // Near-field: Sprites (one per species)
      const seen = new Set<string>()
      distList.forEach((d) => {
        if (seen.has(d.species_id)) return
        seen.add(d.species_id)
        if (!speciesDistMap.current[d.species_id]) {
          speciesDistMap.current[d.species_id] = d
        }
        const sp = speciesMap.current[d.species_id]
        const imgUrl = (sp && sp.images && sp.images[0]) ? sp.images[0] : null

        const fallbackTex = loader.load(makeGlowDataURL('#FF8C00', 128))
        const mat = new THREE.SpriteMaterial({ map: fallbackTex, transparent: true, depthWrite: false })
        const sprite = new THREE.Sprite(mat)
        const [x, y, z] = latLonToVec3(d.latitude, d.longitude, EARTH_R + 0.3)
        sprite.position.set(x, y, z)
        sprite.scale.set(4, 4, 1)
        sprite.visible = false
        sprite.userData = { species_id: d.species_id, imgUrl, loaded: false, mat }
        // Sprites are in earthGroup
        earthGroup.add(sprite)
        spriteMarkers.push(sprite)
      })
    }

    if (distributions.length > 0) buildMarkers(distributions)

    // ── Raycaster for click ─────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let activeLabelObj: CSS2DObject | null = null

    const onMouseClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      // Priority 1: sprites (when visible, they're on top)
      const spriteHits = raycaster.intersectObjects(spriteMarkers, false)
      if (spriteHits.length > 0 && spriteHits[0].object.visible) {
        const sprite = spriteHits[0].object as any
        const sp = speciesMap.current[sprite.userData.species_id]
        const dist = speciesDistMap.current[sprite.userData.species_id]
        if (!sp || !dist) return
        // Dismiss any existing card first
        dismissCard()
        setTimeout(() => flyToRegionAndShowCard(sp, dist), 50)
        return
      }

      // Priority 2: instanced dots
      if (instancedMarkers) {
        const instHits = raycaster.intersectObject(instancedMarkers)
        if (instHits.length > 0) {
          const idx = instHits[0].instanceId
          if (idx !== undefined && idx < distRef.current.length) {
            const d = distRef.current[idx]
            const sp = speciesMap.current[d.species_id]
            if (!sp) return
            dismissCard()
            setTimeout(() => flyToRegionAndShowCard(sp, d), 50)
            return
          }
        }
      }

      // Dismiss on empty click (unless card is visible → close button handles it)
      if (!cardVisible) {
        if (activeLabelObj) { scene.remove(activeLabelObj); activeLabelObj = null }
      }
    }
    renderer.domElement.addEventListener('click', onMouseClick)

    // Store refs
    stateRef.current = {
      scene, camera, renderer, controls, labelRenderer,
      earthGroup, earthMesh,
      instancedMarkers, spriteMarkers,
      buildMarkers,
      activeLabelObj,
    }

    // ── Animation loop ─────────────────────────────────────────────────────
    let animId: number
    const animate = (time: number) => {
      animId = requestAnimationFrame(animate)
      TWEEN.update(time)
      controls.update()

      const dist = camera.position.length()

      // LOD switching
      if (instancedMarkers) {
        const showSprites = dist < 42
        // When card is visible, always show sprites for context
        const forceSprites = cardVisible
        if (!forceSprites) {
          instancedMarkers.visible = !showSprites
        } else {
          instancedMarkers.visible = false
        }
        spriteMarkers.forEach(s => { s.visible = showSprites || forceSprites })

        // Lazy load species images
        if (showSprites || forceSprites) {
          spriteMarkers.forEach((sprite: any) => {
            if (!sprite.userData.loaded && sprite.userData.imgUrl) {
              new THREE.TextureLoader().load(
                sprite.userData.imgUrl,
                (tex: any) => { sprite.material.map = tex; sprite.material.needsUpdate = true; sprite.userData.loaded = true },
                undefined,
                () => { /* keep fallback */ }
              )
              sprite.userData.loaded = true
            }
          })
        }
      }

      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    }
    animate(0)

    // Handle resize
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

  // Rebuild markers when distributions arrive
  useEffect(() => {
    const sr = stateRef.current
    if (sr.scene && distributions.length > 0 && sr.buildMarkers) {
      distRef.current = distributions
      sr.buildMarkers(distributions)
    }
  }, [distributions])

  // Rebuild sprites when species load (after distributions already built)
  useEffect(() => {
    species.forEach((s: any) => { speciesMap.current[s.id] = s })
  }, [species])

  // Season change
  const cycleSeason = () => {
    const keys = Object.keys(SEASONS)
    const cur = keys.indexOf(season.key)
    const next = keys[(cur + 1) % keys.length]
    setSeason({ key: next, label: SEASONS[next].label })
  }

  return (
    <div className="relative w-full h-full" style={{ overflow: 'hidden' }}>
      <div ref={mountRef} className="w-full h-full" />
      <div ref={labelRef} className="absolute inset-0" style={{ zIndex: 10 }} />

      {/* ── Sliding species card (portal-like, overlaid on canvas) ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: cardVisible ? 'auto' : 'none',
          zIndex: 150,
          transform: cardVisible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.75s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={() => {}} /* capture click so it doesn't pass through */
      >
        {cardData && (
          <SpeciesCardPanel
            data={cardData}
            onClose={dismissCard}
          />
        )}
      </div>

      {/* ── Controls overlay ── */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <button
          onClick={cycleSeason}
          style={{
            background: 'rgba(0,20,40,0.85)',
            border: '1px solid rgba(0,212,255,0.4)',
            borderRadius: '8px',
            color: 'white',
            padding: '8px 14px',
            fontSize: '13px',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
          }}
        >
          {season.label}
        </button>

        <div style={{
          background: 'rgba(0,20,40,0.80)',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '11px',
          color: '#aaa',
          backdropFilter: 'blur(6px)',
          lineHeight: '1.8',
        }}>
          🔵 点击光点 → 飞向区域 + 显示卡片<br/>
          ☀️ 滚轮缩放 · 拖拽旋转<br/>
          ✕ 卡片右上角关闭
        </div>
      </div>
    </div>
  )
}

interface Season { key: string; label: string }
