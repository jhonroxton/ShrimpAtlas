/**
 * useViewer.ts — Cesium viewer lifecycle hook
 *
 * Manages:
 * - Dynamic import of Cesium
 * - Viewer creation with proper cleanup
 * - Global error boundary
 */
import { useEffect, useRef } from 'react'

export function useViewer(
  mountRef: React.RefObject<HTMLDivElement>,
  onReady: (viewer: any, Ces: any) => void,
  onError: (err: string) => void,
) {
  const viewRef   = useRef<any>(null)
  const cesRef    = useRef<any>(null)
  const initRef   = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (initRef.current) return
      initRef.current = true

      try {
        const Ces = await import('cesium')
        if (cancelled || !mountRef.current) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const C: any = Ces
        cesRef.current = C
        ;(window as any).CESIUM_BASE_URL = '/cesium'

        // Wait for DOM size
        const el = mountRef.current
        if (el.clientWidth === 0) {
          await new Promise<void>(res => {
            const obs = new ResizeObserver(() => { obs.disconnect(); res() })
            obs.observe(el)
            setTimeout(res, 2500)
          })
        }
        if (cancelled) return

        const viewer = new C.Viewer(el, {
          imageryProvider: new C.UrlTemplateImageryProvider({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            credit: '© OpenStreetMap contributors',
            crossOrigin: 'anonymous',
            hasAlphaChannel: false,
            minimumLevel: 0,
            maximumLevel: 19,
          }),
          terrainProvider: new C.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          selectionIndicator: false,
          infoBox: false,
          creditContainer: document.createElement('div'),
          skyAtmosphere: new C.SkyAtmosphere(),
          requestRenderMode: false,
        })

        if (cancelled) { viewer.destroy(); return }
        viewRef.current = viewer
        onReady(viewer, C)

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[useViewer]', msg)
        onError(msg)
      }
    }

    requestAnimationFrame(() => requestAnimationFrame(boot))

    return () => {
      cancelled = true
      if (viewRef.current) {
        try { viewRef.current.destroy() } catch {}
        viewRef.current = null
      }
      initRef.current = false
    }
  }, [])  // intentionally empty — lifecycle tied to mountRef

  return { viewRef, cesRef }
}
