// Minimal test page for Three.js in React
import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'

declare const THREE: any
declare const OrbitControls: any

export default function TestGlobe() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return
    const container = mountRef.current

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000814, 1)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 1000)
    camera.position.set(0, 0, 50)

    const geo = new THREE.SphereGeometry(20, 32, 32)
    const mat = new THREE.MeshPhongMaterial({ color: 0x223366 })
    scene.add(new THREE.Mesh(geo, mat))
    scene.add(new THREE.AmbientLight(0xffffff, 1))

    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    console.log('TestGlobe mounted, THREE:', THREE.REVISION)
    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
}

// Mount
const root = createRoot(document.getElementById('root')!)
root.render(<TestGlobe />)
