'use client'

import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { getBlobAsUrl, revokeUrl } from '@/lib/db/blobs'
import type { Hotspot } from '@/lib/db/schema'
import { useState } from 'react'

export interface ViewState {
  yaw: number
  pitch: number
  hfov: number
}

interface Props {
  panoramaBlobId: string
  haov?: number
  vaov?: number
  initialYaw?: number
  initialPitch?: number
  initialHfov?: number
  hotspots?: Hotspot[]
  onHotspotClick?: (hs: Hotspot) => void
  onViewChange?: (v: ViewState) => void
  onCanvasClick?: (pos: { yaw: number; pitch: number }) => void
  mode?: 'view' | 'edit'
  autoRotate?: boolean
  gyroEnabled?: boolean
  activeInfoHotspotId?: string
  onInfoClose?: () => void
  className?: string
}

// Panorama (yaw, pitch) degrees → 3D position on a sphere of radius r.
// yaw=0 → looking at -Z (forward). Positive yaw = clockwise (rightward).
function toVec3(yaw: number, pitch: number, r = 490): [number, number, number] {
  const y = (yaw * Math.PI) / 180
  const p = (pitch * Math.PI) / 180
  return [
    r * Math.sin(y) * Math.cos(p),
    r * Math.sin(p),
    -r * Math.cos(y) * Math.cos(p),
  ]
}

function fromVec3(x: number, y: number, z: number): { yaw: number; pitch: number } {
  const r = Math.sqrt(x * x + y * y + z * z)
  return {
    yaw: (Math.atan2(x, -z) * 180) / Math.PI,
    pitch: (Math.asin(y / r) * 180) / Math.PI,
  }
}

// Sets camera orientation from panorama yaw/pitch without gimbal lock.
function applyCameraRotation(camera: THREE.PerspectiveCamera, yaw: number, pitch: number) {
  const qYaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    (-yaw * Math.PI) / 180,
  )
  const qPitch = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    (pitch * Math.PI) / 180,
  )
  camera.quaternion.multiplyQuaternions(qYaw, qPitch)
}

// ── Inner R3F scene (must live inside <Canvas>) ────────────────────────────────

interface SceneProps {
  url: string
  haov: number
  vaov: number
  initialYaw: number
  initialPitch: number
  initialHfov: number
  hotspots: Hotspot[]
  onHotspotClick?: (hs: Hotspot) => void
  onViewChange?: (v: ViewState) => void
  onCanvasClick?: (pos: { yaw: number; pitch: number }) => void
  mode: 'view' | 'edit'
  autoRotate: boolean
  gyroEnabled: boolean
  activeInfoHotspotId?: string
  onInfoClose?: () => void
}

function PanoScene({
  url,
  haov,
  vaov,
  initialYaw,
  initialPitch,
  initialHfov,
  hotspots,
  onHotspotClick,
  onViewChange,
  onCanvasClick,
  mode,
  autoRotate,
  gyroEnabled,
  activeInfoHotspotId,
  onInfoClose,
}: SceneProps) {
  const { camera, gl } = useThree()
  const cam = camera as THREE.PerspectiveCamera
  const texture = useLoader(THREE.TextureLoader, url)

  const yaw = useRef(initialYaw)
  const pitch = useRef(initialPitch)
  const hfov = useRef(initialHfov)
  const lastPtr = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const autoRotateRef = useRef(autoRotate)

  useEffect(() => { autoRotateRef.current = autoRotate }, [autoRotate])

  // Apply initial view on mount
  useEffect(() => {
    applyCameraRotation(cam, yaw.current, pitch.current)
    cam.fov = hfov.current
    cam.updateProjectionMatrix()
  }, [cam])

  // Correct texture color space
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])

  // Scroll to zoom (adjust FOV)
  useEffect(() => {
    const el = gl.domElement
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      hfov.current = Math.max(30, Math.min(120, hfov.current + e.deltaY * 0.05))
      cam.fov = hfov.current
      cam.updateProjectionMatrix()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [cam, gl])

  // Enable single-finger drag on touch devices
  useEffect(() => {
    gl.domElement.style.touchAction = 'none'
  }, [gl])

  // Gyroscope / DeviceOrientation tracking
  useEffect(() => {
    if (!gyroEnabled) return
    let initialAlpha: number | null = null
    const startYaw = yaw.current

    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null) return
      if (initialAlpha === null) initialAlpha = e.alpha
      // Wrap-safe yaw delta from initial compass heading
      let delta = initialAlpha - e.alpha
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      yaw.current = startYaw + delta
      // beta=90 means phone held upright → horizon (pitch=0)
      pitch.current = Math.max(-85, Math.min(85, e.beta - 90))
      applyCameraRotation(cam, yaw.current, pitch.current)
    }

    window.addEventListener('deviceorientation', handler, true)
    return () => window.removeEventListener('deviceorientation', handler, true)
  }, [gyroEnabled, cam])

  // Per-frame: auto-rotate + throttled view state reporting
  const viewTimer = useRef(0)
  useFrame((_, delta) => {
    if (autoRotateRef.current) {
      yaw.current += delta * 8
      applyCameraRotation(cam, yaw.current, pitch.current)
    }
    if (onViewChange) {
      viewTimer.current += delta
      if (viewTimer.current > 0.1) {
        viewTimer.current = 0
        onViewChange({ yaw: yaw.current, pitch: pitch.current, hfov: hfov.current })
      }
    }
  })

  // Sphere geometry for full or partial panoramas
  const phiLength = (haov / 360) * Math.PI * 2
  const thetaStart = ((180 - vaov) / 2 / 180) * Math.PI
  const thetaLength = (vaov / 180) * Math.PI

  return (
    <>
      {/* scale={[-1, 1, 1]} mirrors the sphere geometry so the equirectangular texture
          reads left-to-right from inside, matching A-Frame's a-sky default behaviour. */}
      <mesh
        scale={[-1, 1, 1]}
        onPointerDown={(e) => {
          isDragging.current = true
          lastPtr.current = { x: e.clientX, y: e.clientY }
          ;(e.target as Element).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!isDragging.current) return
          const dx = e.clientX - lastPtr.current.x
          const dy = e.clientY - lastPtr.current.y
          lastPtr.current = { x: e.clientX, y: e.clientY }
          const sens = hfov.current / gl.domElement.clientHeight
          yaw.current += dx * sens
          pitch.current -= dy * sens
          pitch.current = Math.max(-85, Math.min(85, pitch.current))
          applyCameraRotation(cam, yaw.current, pitch.current)
        }}
        onPointerUp={() => { isDragging.current = false }}
        onClick={(e) => {
          if (mode !== 'edit' || !onCanvasClick) return
          const { x, y, z } = e.point
          onCanvasClick(fromVec3(x, y, z))
        }}
      >
        <sphereGeometry args={[500, 64, 32, 0, phiLength, thetaStart, thetaLength]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>

      {hotspots.map((h) => {
        const isActive = h.type === 'info' && h.id === activeInfoHotspotId
        return (
          <Html key={h.id} position={toVec3(h.yaw, h.pitch)} center zIndexRange={isActive ? [300, 200] : [100, 0]}>
            <div
              className={h.type === 'scene-link' ? 'pano-hs-scene' : 'pano-hs-info'}
              onClick={(e) => { e.stopPropagation(); onHotspotClick?.(h) }}
            >
              {h.type === 'scene-link' ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  {h.title && <span className="pano-hs-label">{h.title}</span>}
                </>
              ) : (
                <>
                  <em>i</em>
                  {/* Always-visible title tag below the icon */}
                  {h.title && <span className="pano-hs-title-always">{h.title}</span>}
                  {/* Floating tracked card when active */}
                  {isActive && (
                    <div className="pano-hs-card" onClick={(e) => e.stopPropagation()}>
                      <button className="pano-hs-card-close" onClick={(e) => { e.stopPropagation(); onInfoClose?.() }}>✕</button>
                      {h.title && <p className="pano-hs-card-title">{h.title}</p>}
                      {h.description && <p className="pano-hs-card-body">{h.description}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          </Html>
        )
      })}
    </>
  )
}

// ── Public component ───────────────────────────────────────────────────────────

export function PanoViewer({
  panoramaBlobId,
  haov = 360,
  vaov = 180,
  initialYaw = 0,
  initialPitch = 0,
  initialHfov = 75,
  hotspots = [],
  onHotspotClick,
  onViewChange,
  onCanvasClick,
  mode = 'view',
  autoRotate = false,
  gyroEnabled = false,
  activeInfoHotspotId,
  onInfoClose,
  className = '',
}: Props) {
  const [panoUrl, setPanoUrl] = useState<string | null>(null)
  const [blobLoading, setBlobLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!panoramaBlobId) return
    let active = true
    let url: string | undefined
    setBlobLoading(true)
    setLoadError(null)
    setPanoUrl(null)
    getBlobAsUrl(panoramaBlobId)
      .then((u) => {
        if (!active) { if (u) revokeUrl(u); return }
        if (u) { url = u; setPanoUrl(u) }
        else setLoadError('Panorama not found in storage.')
      })
      .catch(() => { if (active) setLoadError('Failed to load panorama.') })
      .finally(() => { if (active) setBlobLoading(false) })
    return () => {
      active = false
      if (url) { revokeUrl(url); url = undefined }
    }
  }, [panoramaBlobId])

  const isLoading = blobLoading || !panoUrl

  return (
    <>
      <style>{`
        .pano-hs-scene, .pano-hs-info {
          position: relative;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: transform 0.2s;
          animation: pano-pulse 2s ease-in-out infinite;
        }
        .pano-hs-scene {
          width: 40px; height: 40px;
          border: 2px solid #d97757;
          color: #d97757;
          background: rgba(13,12,10,0.7);
        }
        .pano-hs-scene svg { width: 18px; height: 18px; }
        .pano-hs-info {
          width: 32px; height: 32px;
          border: 2px solid #f5f0e6;
          color: #f5f0e6;
          background: rgba(13,12,10,0.7);
          font-style: italic;
          font-family: Georgia, serif;
          font-size: 15px;
        }
        .pano-hs-scene:hover, .pano-hs-info:hover { transform: scale(1.15); }
        .pano-hs-label {
          position: absolute;
          bottom: 110%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(22,20,15,0.9);
          color: #f5f0e6;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          padding: 3px 8px;
          border-radius: 2px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .pano-hs-scene:hover .pano-hs-label { opacity: 1; }
        .pano-hs-title-always {
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(13,12,10,0.82);
          color: #f5f0e6;
          font-size: 11px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 3px;
          white-space: nowrap;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
        }
        .pano-hs-card {
          position: absolute;
          bottom: calc(100% + 14px);
          left: 50%;
          transform: translateX(-50%);
          width: min(230px, 80vw);
          background: rgba(13,12,10,0.96);
          border: 1px solid rgba(245,240,230,0.14);
          border-radius: 10px;
          padding: 14px 14px 12px;
          pointer-events: auto;
          box-shadow: 0 12px 40px rgba(0,0,0,0.7);
        }
        .pano-hs-card-close {
          position: absolute;
          top: 8px; right: 10px;
          background: none; border: none;
          color: rgba(245,240,230,0.4);
          font-size: 15px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .pano-hs-card-close:hover { color: #f5f0e6; }
        .pano-hs-card-title {
          margin: 0 0 6px;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Space Grotesk', sans-serif;
          color: #f5f0e6;
          line-height: 1.3;
          padding-right: 18px;
        }
        .pano-hs-card-body {
          margin: 0;
          font-size: 12px;
          color: rgba(245,240,230,0.65);
          line-height: 1.6;
          white-space: pre-line;
        }
        @keyframes pano-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,87,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(217,119,87,0); }
        }
      `}</style>

      <div
        className={`bg-black ${className}`}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      >
        {isLoading && !loadError && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 }} className="z-10 pointer-events-none overflow-hidden">
            <div className="h-full bg-accent/60 animate-pulse" />
          </div>
        )}
        {loadError && (
          <div style={{ position: 'absolute', inset: 0 }} className="flex items-center justify-center z-10">
            <p className="font-mono text-xs text-error">{loadError}</p>
          </div>
        )}

        {panoUrl && (
          <Canvas
            camera={{ position: [0, 0, 0], fov: initialHfov, near: 0.1, far: 1000 }}
            gl={{ antialias: true }}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <PanoScene
                url={panoUrl}
                haov={haov}
                vaov={vaov}
                initialYaw={initialYaw}
                initialPitch={initialPitch}
                initialHfov={initialHfov}
                hotspots={hotspots}
                onHotspotClick={onHotspotClick}
                onViewChange={onViewChange}
                onCanvasClick={onCanvasClick}
                mode={mode}
                autoRotate={autoRotate}
                gyroEnabled={gyroEnabled}
                activeInfoHotspotId={activeInfoHotspotId}
                onInfoClose={onInfoClose}
              />
            </Suspense>
          </Canvas>
        )}
      </div>
    </>
  )
}
