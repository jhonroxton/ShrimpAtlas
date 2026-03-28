// @ts-nocheck
/**
 * Globe3Dv2.tsx — Three.js Earth Globe (Rebuild)
 * Phase 1+2: Earth base + distribution markers + near-species images + popup cards
 *
 * Architecture:
 * - InstancedMesh: 20k+ distribution dots (efficient GPU instancing)
 * - CSS2DRenderer: HTML popup cards with shrimp details
 * - Sprite LOD: near view shows species images
 * - Tween.js: smooth camera zoom transitions
 * - Season toggle: changes earth appearance
 */

import { useEffect, useRef, useState } from 'react'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import * as TWEEN from '@tweenjs/tween.js'
import type { SpeciesDistribution } from '../types/shrimp'

const EARTH_R = 20

// ── Math helpers ─────────────────────────────────────────────────────────────

/** Convert lat/lon (degrees) to Three.js Vector3 at radius R */
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

// ── Popup card component ─────────────────────────────────────────────────────

function makeShrimpCard(sp: any): HTMLDivElement {
  const div = document.createElement('div')
  div.style.cssText = `
    background: rgba(5,15,35,0.95);
    border: 1.5px solid rgba(0,212,255,0.5);
    border-radius: 12px;
    padding: 14px 16px;
    color: white;
    font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
    width: 220px;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,212,255,0.1);
    pointer-events: none;
    user-select: none;
    overflow: hidden;
  `

  // IUCN status color
  const iucnColors: Record<string, string> = {
    LC: '#7FD17F', NT: '#A8D17F', VU: '#FFD700', EN: '#FFA500',
    CR: '#FF4444', EW: '#FF88FF', EX: '#888888', DD: '#AAAAAA',
  }
  const iucnColor = iucnColors[sp.iucn_status] || '#AAAAAA'
  const iucnLabel: Record<string, string> = {
    LC: '无危', NT: '近危', VU: '易危', EN: '濒危',
    CR: '极危', EW: '野外灭绝', EX: '灭绝', DD: '数据缺乏',
  }

  const cnName = sp.cn_name || sp.chinese_name || sp.en_name || '—'
  const enName = sp.en_name || sp.english_name || '—'
  const sciName = sp.scientific_name || '—'
  const habitat = sp.habitat || '—'
  const diet = sp.diet || '—'
  const tempZone = sp.temperature_zone || '—'
  const iucn = sp.iucn_status ? `${sp.iucn_status} (${iucnLabel[sp.iucn_status] || sp.iucn_status})` : '—'
  const maxLen = sp.max_length_cm ? `${sp.max_length_cm} cm` : '—'
  const edible = sp.is_edible ? '✅ 可食用' : '⚠️ 不可食用'

  const zoneEmoji: Record<string, string> = { tropical: '🌴', temperate: '🍂', cold: '❄️', unknown: '🌍' }
  const zoneLabel: Record<string, string> = { tropical: '热带', temperate: '温带', cold: '寒带' }

  div.innerHTML = `
    <div style="font-size:16px;font-weight:bold;color:#FFD700;margin-bottom:8px;line-height:1.3">
      ${cnName}
    </div>
    <div style="font-size:11px;color:#aaa;margin-bottom:10px;font-style:italic;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px">
      ${sciName}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10.5px;color:#ccc;margin-bottom:8px">
      <div>🏠 <span style="color:${iucnColor};font-weight:bold">${iucn}</span></div>
      <div>📏 <span style="color:#ddd">${maxLen}</span></div>
      <div>${zoneEmoji[sp.temperature_zone] || '🌍'} <span style="color:#ddd">${zoneLabel[sp.temperature_zone] || tempZone}</span></div>
      <div>🍖 <span style="color:#ddd">${diet.substring(0,6) || '—'}</span></div>
    </div>
    <div style="font-size:10px;color:#999;margin-bottom:6px">
      🌊 栖息地：<span style="color:#ccc">${habitat}</span>
    </div>
    <div style="font-size:11px;color:${sp.is_edible ? '#7FD17F' : '#FF7F7F'};margin-top:4px">
      ${edible}
    </div>
  `
  return div
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
  species?: any[]          // full species records
  speciesImages?: Record<string, string>
}

interface Season { key: string; label: string }

export default function Globe3D({ distributions = [], species = [], speciesImages = {} }: Props) {
  const mountRef   = useRef<HTMLDivElement>(null)
  const labelRef   = useRef<HTMLDivElement>(null)
  const [season, setSeason] = useState<Season>({ key: 'spring', label: '🌸 春季' })
  const [tooltip, setTooltip] = useState<{ name: string; visible: boolean }>({ name: '', visible: false })
  const stateRef = useRef<Record<string, any>>({})

  // Build species lookup map
  const speciesMap = useRef<Record<string, any>>({})
  const distRef = useRef<SpeciesDistribution[]>([])
  // speciesId -> first distribution (for click popup position)
  const speciesDistMap = useRef<Record<string, SpeciesDistribution>>({})
  useEffect(() => {
    species.forEach((s: any) => { speciesMap.current[s.id] = s })
  }, [species])

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

    // CSS2DRenderer for popup cards
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

    // Earth texture loader
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
    scene.add(earthMesh)

    // Atmosphere
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R + 1.2, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x0088cc, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
    ))

    // ── InstancedMesh for distribution dots (efficient!) ──────────────────
    let instancedMarkers: any = null
    let dotMatrix = new THREE.Matrix4()
    let dotTempObj = new THREE.Object3D()
    let dotCount = 0
    let dotVisible = true

    // ── Species sprite images (near-field LOD) ───────────────────────────
    let spriteMarkers: any[] = []
    let spriteVisible = false

    const buildMarkers = (distList: SpeciesDistribution[]) => {
      if (!distList || distList.length === 0) return

      distRef.current = distList  // store for click handler

      // Remove old markers
      if (instancedMarkers) { scene.remove(instancedMarkers); instancedMarkers.geometry.dispose() }
      spriteMarkers.forEach(s => scene.remove(s))
      spriteMarkers = []

      const n = distList.length
      dotCount = n

      // Far-field: InstancedMesh dots
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
      scene.add(instancedMarkers)

      // Near-field: Sprites (one per species)
      const seen = new Set<string>()
      distList.forEach((d) => {
        if (seen.has(d.species_id)) return
        seen.add(d.species_id)
        if (!speciesDistMap.current[d.species_id]) {
          speciesDistMap.current[d.species_id] = d  // store for click popup
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
        scene.add(sprite)
        spriteMarkers.push(sprite)
      })
    }

    // Build markers when distributions arrive
    if (distributions.length > 0) buildMarkers(distributions)

    // ── Raycaster for click-to-show-card ─────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let activeLabelObj: CSS2DObject | null = null

    const onMouseClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      // Priority 1: Check sprite markers first (they sit on top when visible)
      const spriteHits = raycaster.intersectObjects(spriteMarkers, false)
      if (spriteHits.length > 0) {
        const sprite = spriteHits[0].object as any
        const sp = speciesMap.current[sprite.userData.species_id]
        const dist = speciesDistMap.current[sprite.userData.species_id]
        if (!sp || !dist) return

        if (activeLabelObj) { scene.remove(activeLabelObj); activeLabelObj = null }
        const cardDiv = makeShrimpCard(sp)
        const labelObj = new CSS2DObject(cardDiv)
        const [x, y, z] = latLonToVec3(dist.latitude, dist.longitude, EARTH_R + 2.5)
        labelObj.position.set(x, y, z)
        scene.add(labelObj)
        activeLabelObj = labelObj
        setTooltip({ name: sp.cn_name || sp.scientific_name, visible: true })
        return
      }

      // Priority 2: Check instanced markers (far-field dots)
      if (instancedMarkers) {
        const instHits = raycaster.intersectObject(instancedMarkers)
        if (instHits.length > 0) {
          const idx = instHits[0].instanceId
          if (idx !== undefined && idx < distRef.current.length) {
            const d = distRef.current[idx]
            const sp = speciesMap.current[d.species_id]
            if (!sp) return

            if (activeLabelObj) { scene.remove(activeLabelObj); activeLabelObj = null }
            const cardDiv = makeShrimpCard(sp)
            const labelObj = new CSS2DObject(cardDiv)
            const [x, y, z] = latLonToVec3(d.latitude, d.longitude, EARTH_R + 2)
            labelObj.position.set(x, y, z)
            scene.add(labelObj)
            activeLabelObj = labelObj
            setTooltip({ name: sp.cn_name || sp.scientific_name, visible: true })
            return
          }
        }
      }

      // Clicked on nothing relevant — dismiss card
      if (activeLabelObj) { scene.remove(activeLabelObj); activeLabelObj = null }
      setTooltip(t => ({ ...t, visible: false }))
    }
    renderer.domElement.addEventListener('click', onMouseClick)

    // Store refs
    stateRef.current = {
      scene, camera, renderer, controls, labelRenderer,
      earthMesh, earthTex, instancedMarkers, spriteMarkers,
      buildMarkers, distributions, dotVisible, spriteVisible,
    }

    // ── Animation loop ─────────────────────────────────────────────────
    let animId: number
    const animate = (time: number) => {
      animId = requestAnimationFrame(animate)
      TWEEN.update(time)
      controls.update()

      const dist = camera.position.length()

      // LOD switching
      if (instancedMarkers) {
        const showSprites = dist < 42
        instancedMarkers.visible = !showSprites
        spriteMarkers.forEach(s => { s.visible = showSprites })

        // Lazy load species real images
        if (showSprites) {
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
  }, []) // eslint-disable-line

  // Rebuild markers when distributions change
  useEffect(() => {
    const sr = stateRef.current
    if (sr.scene && distributions.length > 0 && sr.buildMarkers) {
      distRef.current = distributions
      sr.buildMarkers(distributions)
    }
  }, [distributions])

  // ── Season change ───────────────────────────────────────────────────────
  const cycleSeason = () => {
    const keys = Object.keys(SEASONS)
    const cur = keys.indexOf(season.key)
    const next = keys[(cur + 1) % keys.length]
    setSeason({ key: next, label: SEASONS[next].label })
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      <div ref={labelRef} className="absolute inset-0" style={{ zIndex: 10 }} />

      {/* Season toggle */}
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

        {tooltip.visible && (
          <div style={{
            background: 'rgba(0,20,40,0.88)',
            border: '1px solid rgba(0,212,255,0.4)',
            borderRadius: '8px',
            color: '#FFD700',
            padding: '6px 12px',
            fontSize: '12px',
            backdropFilter: 'blur(6px)',
          }}>
            📍 {tooltip.name}
          </div>
        )}

        <div style={{
          background: 'rgba(0,20,40,0.7)',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '11px',
          color: '#aaa',
          backdropFilter: 'blur(6px)',
        }}>
          🔵 虾类分布点 · 点击查看详情<br/>
          ☀️ 滚轮放大查看物种图片
        </div>
      </div>
    </div>
  )
}
