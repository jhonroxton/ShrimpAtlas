// @ts-nocheck
/**
 * GlobeGlobe.tsx — Three.js 3D地球 + 分布点粒子 + 物种卡片
 * 行为:
 *  - 3D地球 + 洋流动画
 *  - 分布点显示为发光粒子
 *  - 点击/选中粒子 → 显示物种详情卡
 *  - 侧边栏筛选 → 实时更新分布点
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import * as TWEEN from '@tweenjs/tween.js'
import type { SpeciesDistribution } from '../types/shrimp'

const EARTH_R = 20

// ── 工具函数 ────────────────────────────────────────────────────────────────
function latLonToVec3(lat: number, lon: number, r = EARTH_R): [number, number, number] {
  const phi = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ]
}

function makeGlowDataURL(color: string, size = 64): string {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')!
  const cx = size / 2, cy = size / 2, rad = size * 0.42
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
  g.addColorStop(0, color); g.addColorStop(0.4, color + 'cc'); g.addColorStop(1, color + '00')
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)
  ctx.beginPath(); ctx.arc(cx, cy, rad * 0.2, 0, Math.PI * 2)
  ctx.fillStyle = 'white'; ctx.fill()
  return cv.toDataURL()
}

// ── 常量 ────────────────────────────────────────────────────────────────────
const OCEAN_CURRENTS = [
  { name: '黑潮',           type: 'warm', coords: [[130,20],[140,28],[150,35],[165,42],[180,45]] },
  { name: '湾流',           type: 'warm', coords: [[-80,22],[-70,30],[-60,40],[-50,50],[-30,58]] },
  { name: '加利福尼亚寒流', type: 'cold', coords: [[-115,45],[-122,38],[-128,28],[-130,18]] },
  { name: '秘鲁寒流',       type: 'cold', coords: [[-80,-5],[-85,-12],[-90,-18],[-95,-25]] },
  { name: '厄加勒斯暖流',   type: 'warm', coords: [[20,-30],[30,-35],[40,-38],[50,-40]] },
]

// ── Props ───────────────────────────────────────────────────────────────────
interface Props {
  distributions: SpeciesDistribution[]
  species: any[]
  speciesImages: Record<string, string>
  onSpeciesClick?: (species: any, dist: SpeciesDistribution) => void
}

// ── 物种详情卡片 HTML ──────────────────────────────────────────────────────
function makeDetailCardHTML(sp: any, imgUrl: string | null): string {
  const cn = sp.cn_name || sp.en_name || sp.scientific_name || '—'
  const en = sp.en_name || ''
  const sci = sp.scientific_name || ''
  const status = sp.iucn_status || 'DD'
  const len = sp.max_length_cm ? `${sp.max_length_cm} cm` : '—'
  const edible = sp.is_edible ? '✅ 可食用' : '⚠️ 不可食用'
  const statusColor = { LC:'#7FD17F', NT:'#A8D17F', VU:'#FFD700', EN:'#FFA500', CR:'#FF4444', DD:'#AAAAAA' }[status] || '#AAAAAA'
  const img = imgUrl
    ? `<img src="${imgUrl}" alt="${cn}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.style.display='none'"/>`
    : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem;">🦐</div>`

  return `
    <div class="detail-card" style="
      background:rgba(5,15,35,0.97);
      border:1.5px solid rgba(0,212,255,0.5);
      border-radius:16px;
      padding:18px;
      width:300px;
      color:white;
      font-family:'PingFang SC','Microsoft YaHei',sans-serif;
      backdrop-filter:blur(16px);
      box-shadow:0 8px 40px rgba(0,0,0,0.7),0 0 30px rgba(0,212,255,0.12);
    ">
      <div style="width:100%;height:150px;border-radius:10px;background:#0a1a2e;margin-bottom:12px;overflow:hidden;">
        ${img}
      </div>
      <div style="font-size:17px;font-weight:bold;color:#FFD700;margin-bottom:4px;">${cn}</div>
      <div style="font-size:12px;color:#aaa;font-style:italic;margin-bottom:2px;">${sci}</div>
      <div style="font-size:11px;color:#777;margin-bottom:10px;">${en}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:8px;">
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:7px;">
          <span style="color:#888;">保护状态</span>
          <div style="color:${statusColor};margin-top:2px;">${status}</div>
        </div>
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:7px;">
          <span style="color:#888;">最大体长</span>
          <div style="color:#ddd;margin-top:2px;">${len}</div>
        </div>
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:7px;">
          <span style="color:#888;">温度带</span>
          <div style="color:#ddd;margin-top:2px;">${sp.temperature_zone || '—'}</div>
        </div>
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:7px;">
          <span style="color:#888;">是否可食用</span>
          <div style="color:${sp.is_edible ? '#7FD17F' : '#FF7F7F'};margin-top:2px;">${sp.is_edible ? '✅' : '⚠️'}</div>
        </div>
      </div>
      <div style="font-size:11px;color:#999;margin-bottom:8px;">🌊 栖息地：${sp.habitat || '—'}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
        ${sp.family ? `<span style="font-size:10px;background:rgba(0,212,255,0.15);color:#7FD1D1;padding:3px 8px;border-radius:20px;">${sp.family}</span>` : ''}
        ${sp.genus ? `<span style="font-size:10px;background:rgba(0,212,255,0.15);color:#7FD1D1;padding:3px 8px;border-radius:20px;">${sp.genus}</span>` : ''}
      </div>
      <a href="/species/${sp.id}" style="display:block;text-align:center;background:rgba(0,212,255,0.9);color:#001828;font-weight:bold;font-size:13px;padding:10px;border-radius:10px;text-decoration:none;">查看详情 →</a>
    </div>
  `
}

// ── 地球组件 ───────────────────────────────────────────────────────────────
export default function GlobeGlobe({ distributions, species, speciesImages, onSpeciesClick }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const threeRef = useRef<Record<string, any>>({})
  const speciesMapRef = useRef<Record<string, any>>({})
  const [detailCard, setDetailCard] = useState<any>(null)
  const [detailVisible, setDetailVisible] = useState(false)

  // 构建 species id → species data 映射
  useEffect(() => {
    const m: Record<string, any> = {}
    species.forEach((s: any) => { m[s.id] = s })
    speciesMapRef.current = m
  }, [species])

  // 初始化 Three.js 地球
  useEffect(() => {
    if (!mountRef.current) return

    const THREE = (window as any).THREE
    const OC = (window as any).THREE?.OrbitControls
    if (!THREE || !OC) { console.error('[Globe] THREE.js not loaded'); return }

    const container = mountRef.current
    const W = container.clientWidth || 800, H = container.clientHeight || 600

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000510, 1)
    container.appendChild(renderer.domElement)

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()

    // ── Camera ──────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 2000)
    camera.position.set(0, 15, 65)

    // ── Controls ────────────────────────────────────────────────────────────
    const controls = new OC(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.minDistance = EARTH_R + 2
    controls.maxDistance = 120

    // ── Lights ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const sun = new THREE.PointLight(0xffffff, 1.2)
    sun.position.set(50, 30, 50); scene.add(sun)

    // ── Stars ───────────────────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(3000 * 3)
    for (let i = 0; i < 3000 * 3; i++) starPos[i] = (Math.random() - 0.5) * 600
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true })))

    // ── Earth ────────────────────────────────────────────────────────────────
    const earthGroup = new THREE.Group()
    scene.add(earthGroup)
    const loader = new THREE.TextureLoader()

    const earthTex  = loader.load('/textures/earth-blue-marble.jpg')
    const bumpTex   = loader.load('/textures/earth-topology.png')
    const specTex   = loader.load('/textures/earth-water.png')

    earthGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x4a90d9, map: earthTex, bumpMap: bumpTex,
        bumpScale: 0.05, specularMap: specTex,
        specular: new THREE.Color(0x222222), shininess: 10,
      })
    ))

    // Atmosphere glow
    earthGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R + 1.2, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x0088cc, transparent: true, opacity: 0.07,
        side: THREE.BackSide, depthWrite: false,
      })
    ))

    // ── Ocean Currents ──────────────────────────────────────────────────────
    const currParticles: any[] = []
    OCEAN_CURRENTS.forEach(curr => {
      const pts = curr.coords.map(([lon, lat]: [number, number]) => latLonToVec3(lat, lon, EARTH_R + 0.1))
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

    // ── Distribution Points ──────────────────────────────────────────────────
    const distDotGeo = new THREE.BufferGeometry()
    const MAX_DOTS = 30000
    const dotPositions = new Float32Array(MAX_DOTS * 3)
    const dotSizes = new Float32Array(MAX_DOTS)
    const dotData: Array<{ species_id: string; lat: number; lon: number }> = []

    distDotGeo.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3))
    distDotGeo.attributes.position.setUsage(THREE.DynamicDrawUsage)
    distDotGeo.setAttribute('size', new THREE.BufferAttribute(dotSizes, 1))

    const dotTex = loader.load(makeGlowDataURL('#00d4ff', 64))
    const distDots = new THREE.Points(distDotGeo, new THREE.PointsMaterial({
      color: 0x00d4ff, size: 0.5, map: dotTex, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }))
    distDots.userData = { dotData }
    earthGroup.add(distDots)

    // ── Hit spheres for raycasting ────────────────────────────────────────────
    const hitSpheres: any[] = []
    const buildHitSpheres = (data: Array<{ species_id: string; lat: number; lon: number }>) => {
      hitSpheres.forEach((s: any) => earthGroup.remove(s))
      hitSpheres.length = 0
      data.forEach((d: any) => {
        const [x, y, z] = latLonToVec3(d.lat, d.lon, EARTH_R + 0.3)
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 6, 6),
          new THREE.MeshBasicMaterial({ visible: false })
        )
        sphere.position.set(x, y, z)
        sphere.userData = { species_id: d.species_id, lat: d.lat, lon: d.lon }
        earthGroup.add(sphere)
        hitSpheres.push(sphere)
      })
    }

    // ── Update distribution dots ──────────────────────────────────────────────
    const updateDistDots = (dists: SpeciesDistribution[]) => {
      const pos = distDotGeo.attributes.position.array as Float32Array
      const sizes = distDotGeo.attributes.size.array as Float32Array
      const data: Array<{ species_id: string; lat: number; lon: number }> = []

      const count = Math.min(dists.length, MAX_DOTS)
      for (let i = 0; i < count; i++) {
        const d = dists[i]
        const [x, y, z] = latLonToVec3(d.latitude, d.longitude, EARTH_R + 0.2)
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
        sizes[i] = 1.0
        data.push({ species_id: d.species_id, lat: d.latitude, lon: d.longitude })
      }

      distDotGeo.attributes.position.needsUpdate = true
      distDotGeo.attributes.size.needsUpdate = true
      distDotGeo.setDrawRange(0, count)
      distDots.userData.dotData = data
      buildHitSpheres(data)
    }

    // Initial load
    if (distributions.length > 0) updateDistDots(distributions)

    // ── Raycaster ────────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const onMouseClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(hitSpheres)
      if (hits.length > 0) {
        const { species_id, lat, lon } = hits[0].object.userData
        const sp = speciesMapRef.current[species_id]
        if (!sp) return

        // Camera fly-to
        const [tx, ty, tz] = latLonToVec3(lat, lon, EARTH_R)
        const len = Math.sqrt(tx*tx + ty*ty + tz*tz)
        const camDist = EARTH_R * 2.5
        new TWEEN.Tween(camera.position)
          .to({ x: (tx/len)*camDist, y: (ty/len)*camDist, z: (tz/len)*camDist }, 1200)
          .easing(TWEEN.Easing.Cubic.InOut)
          .onUpdate(() => controls.update())
          .start()
        new TWEEN.Tween(controls.target)
          .to({ x: tx, y: ty, z: tz }, 1200)
          .easing(TWEEN.Easing.Cubic.InOut)
          .onUpdate(() => controls.update())
          .start()

        // Show detail card
        const imgUrl = speciesImages[species_id] || (Array.isArray(sp.images) ? sp.images[0] : null) || null
        setDetailCard({ sp, imgUrl })
        setTimeout(() => setDetailVisible(true), 400)

        if (onSpeciesClick) onSpeciesClick(sp, { species_id, latitude: lat, longitude: lon } as SpeciesDistribution)
      }
    }
    renderer.domElement.addEventListener('click', onMouseClick)

    // ── Animation loop ───────────────────────────────────────────────────────
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
        const fx = segLens[si] > 0 ? dist2 / segLens[si] : 0
        const [x, y, z] = latLonToVec3(lat1 + (lat2-lat1)*fx, lon1 + (lon2-lon1)*fx, EARTH_R + 0.1)
        pos[0] = x; pos[1] = y; pos[2] = z
        pts.geometry.attributes.position.needsUpdate = true
      })

      // Auto-rotate earth slightly
      earthGroup.rotation.y += 0.0003

      renderer.render(scene, camera)
    }
    animate(0)

    // ── Resize ──────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!container.clientWidth || !container.clientHeight) return
      renderer.setSize(container.clientWidth, container.clientHeight)
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    // ── Store refs ───────────────────────────────────────────────────────────
    threeRef.current = { scene, camera, renderer, controls, earthGroup, updateDistDots }

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

  // ── 分布点更新（侧边栏筛选变化时）────────────────────────────────────────
  useEffect(() => {
    const r = threeRef.current
    if (!r.updateDistDots || distributions.length === 0) return
    r.updateDistDots(distributions)
  }, [distributions])

  // ── 关闭详情卡 ───────────────────────────────────────────────────────────
  const dismissDetail = useCallback(() => {
    setDetailVisible(false)
    setTimeout(() => setDetailCard(null), 400)
    // Reset camera
    const r = threeRef.current
    if (!r.camera || !r.controls) return
    new TWEEN.Tween(r.camera.position)
      .to({ x: 0, y: 15, z: 65 }, 800)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => r.controls.update())
      .start()
    new TWEEN.Tween(r.controls.target)
      .to({ x: 0, y: 0, z: 0 }, 800)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => r.controls.update())
      .start()
  }, [])

  // ── 渲染 ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full" style={{ overflow: 'hidden' }}>
      <div ref={mountRef} className="w-full h-full" />

      {/* 详情卡 */}
      {detailCard && (
        <div style={{
          position: 'absolute', top: '50%', right: '20px', transform: 'translateY(-50%)',
          transition: 'opacity 0.4s, transform 0.4s',
          opacity: detailVisible ? 1 : 0,
          pointerEvents: detailVisible ? 'auto' : 'none',
          zIndex: 150,
        }}>
          <button
            onClick={dismissDetail}
            style={{
              position: 'absolute', top: '10px', right: '10px',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#aaa', cursor: 'pointer', fontSize: '16px',
              padding: '4px 8px', borderRadius: '6px', zIndex: 10,
            }}
          >✕</button>
          <div dangerouslySetInnerHTML={{ __html: makeDetailCardHTML(detailCard.sp, detailCard.imgUrl) }} />
        </div>
      )}

      {/* 提示文字 */}
      <div style={{
        position: 'absolute', bottom: '12px', right: '16px',
        fontSize: '11px', color: 'rgba(126,200,227,0.6)',
        textAlign: 'right', pointerEvents: 'none',
      }}>
        点击分布点查看物种详情<br/>拖动旋转 · 滚轮缩放
      </div>
    </div>
  )
}
