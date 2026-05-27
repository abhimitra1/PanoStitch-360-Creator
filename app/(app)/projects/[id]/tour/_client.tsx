'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  X, Maximize, Minimize, ChevronLeft, ChevronRight, RotateCcw,
} from 'lucide-react'
import { db } from '@/lib/db/schema'
import type { Hotspot, Scene } from '@/lib/db/schema'
import { getProjectScenes, getSceneHotspots } from '@/lib/db/queries'
import Image from 'next/image'
import { PanoViewer } from '@/components/viewer/PanoViewer'
import { PanoMark } from '@/components/shared/PanoMark'
import { useBlobUrl } from '@/lib/hooks/useBlobUrl'

interface Props {
  params: Promise<{ id: string }>
}

export function TourClient({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()

  const project = useLiveQuery(() => db.projects.get(id), [id])
  const scenes = useLiveQuery(() => getProjectScenes(id), [id]) ?? []

  const [currentSceneId, setCurrentSceneId] = useState<string | null>(
    searchParams.get('scene')
  )
  const [transitioning, setTransitioning] = useState(false)
  const [arrivalYaw, setArrivalYaw] = useState<number | undefined>(undefined)
  const [arrivalPitch, setArrivalPitch] = useState<number | undefined>(undefined)
  const [arrivalHfov, setArrivalHfov] = useState<number | undefined>(undefined)

  // Overlay visibility
  const [overlayVisible, setOverlayVisible] = useState(true)
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)

  // Info panel (for info hotspots)
  const [infoHotspot, setInfoHotspot] = useState<Hotspot | null>(null)

  const currentScene = scenes.find((s) => s.id === currentSceneId) ?? scenes[0] ?? null
  const currentIndex = scenes.findIndex((s) => s.id === currentScene?.id)
  const hotspots = useLiveQuery(
    () => currentScene ? getSceneHotspots(currentScene.id) : (Promise.resolve([]) as Promise<Hotspot[]>),
    [currentScene?.id]
  ) ?? []

  // Default to first scene if none in URL
  useEffect(() => {
    if (scenes.length > 0 && !currentSceneId) {
      setCurrentSceneId(scenes[0].id)
    }
  }, [scenes, currentSceneId])

  // Update URL on scene change
  useEffect(() => {
    if (!currentSceneId) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('scene', currentSceneId)
    router.replace(`/projects/${id}/tour?${params.toString()}`)
  }, [currentSceneId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-hide overlay
  const showOverlay = useCallback(() => {
    setOverlayVisible(true)
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)
    overlayTimerRef.current = setTimeout(() => setOverlayVisible(false), 3000)
  }, [])

  useEffect(() => {
    showOverlay()
    return () => { if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current) }
  }, [showOverlay])

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const navigateTo = useCallback((scene: Scene, yaw?: number, pitch?: number, hfov?: number) => {
    if (transitioning || scene.id === currentScene?.id) return
    setTransitioning(true)
    setArrivalYaw(yaw)
    setArrivalPitch(pitch)
    setArrivalHfov(hfov)
    setTimeout(() => {
      setCurrentSceneId(scene.id)
      setTransitioning(false)
    }, 300)
  }, [transitioning, currentScene?.id])

  const navigatePrev = useCallback(() => {
    if (currentIndex > 0) navigateTo(scenes[currentIndex - 1])
  }, [currentIndex, scenes, navigateTo])

  const navigateNext = useCallback(() => {
    if (currentIndex < scenes.length - 1) navigateTo(scenes[currentIndex + 1])
  }, [currentIndex, scenes, navigateTo])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      showOverlay()
      switch (e.key) {
        case 'ArrowLeft': navigatePrev(); break
        case 'ArrowRight': navigateNext(); break
        case ' ': e.preventDefault(); setAutoRotate((a) => !a); break
        case 'f': toggleFullscreen(); break
        case 'Escape':
          if (infoHotspot) { setInfoHotspot(null); break }
          router.push(`/projects/${id}`)
          break
        case 'i': setInfoHotspot((h) => h ? null : (hotspots.find((hs) => hs.type === 'info') ?? null)); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigatePrev, navigateNext, showOverlay, infoHotspot, hotspots, id, router])

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const handleHotspotClick = useCallback((hs: Hotspot) => {
    if (hs.type === 'info') {
      setInfoHotspot(hs)
      return
    }
    if (hs.type === 'scene-link' && hs.targetSceneId) {
      const target = scenes.find((s) => s.id === hs.targetSceneId)
      if (target) navigateTo(target, hs.targetYaw, hs.targetPitch, hs.targetHfov)
    }
  }, [scenes, navigateTo])

  // Device orientation (iOS)
  const [gyroEnabled, setGyroEnabled] = useState(false)
  async function requestGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
      const perm = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission()
      if (perm === 'granted') {
        setGyroEnabled(true)
        localStorage.setItem('panostitch_gyro', '1')
      }
    } else {
      setGyroEnabled((g) => !g)
    }
  }

  useEffect(() => {
    if (localStorage.getItem('panostitch_gyro') === '1') setGyroEnabled(true)
  }, [])

  if (!currentScene) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        {scenes.length === 0 ? (
          <div className="text-center">
            <p className="font-display font-bold text-2xl text-ink-dim mb-4">No scenes yet.</p>
            <button onClick={() => router.push(`/projects/${id}`)} className="font-mono text-xs text-ink-faint underline">
              back to project
            </button>
          </div>
        ) : (
          <div className="h-1 w-24 bg-line rounded-full overflow-hidden">
            <div className="h-full bg-accent animate-pulse w-1/2" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      onMouseMove={showOverlay}
      onClick={showOverlay}
    >
      {/* Panorama viewer */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: transitioning ? 0 : 1 }}
      >
        <PanoViewer
          key={currentScene.id}
          panoramaBlobId={currentScene.panoramaBlobId}
          previewBlobId={currentScene.previewBlobId}
          haov={currentScene.haov}
          vaov={currentScene.vaov}
          initialYaw={arrivalYaw ?? currentScene.initialYaw}
          initialPitch={arrivalPitch ?? currentScene.initialPitch}
          initialHfov={arrivalHfov ?? currentScene.initialHfov}
          hotspots={hotspots}
          onHotspotClick={handleHotspotClick}
          autoRotate={autoRotate}
          gyroEnabled={gyroEnabled}
          activeInfoHotspotId={infoHotspot?.id}
          onInfoClose={() => setInfoHotspot(null)}
          className="absolute inset-0"
        />
      </div>

      {/* Gyro button — always visible, bottom-right, mobile-prominent */}
      <div className="absolute bottom-32 right-4 z-10 flex flex-col items-end gap-2">
        <button
          onClick={requestGyro}
          title={gyroEnabled ? 'Gyroscope on — tap to disable' : 'Enable gyroscope tracking'}
          className={`h-10 w-10 flex items-center justify-center rounded-full border-2 backdrop-blur-sm transition-colors ${
            gyroEnabled
              ? 'border-accent bg-accent/30 text-accent'
              : 'border-white/30 bg-black/40 text-white/70 hover:border-white/60'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            <path d="M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83" />
          </svg>
        </button>
        {!gyroEnabled && (
          <span className="font-mono text-[9px] text-white/50 tracking-wider uppercase">gyro</span>
        )}
        {gyroEnabled && (
          <span className="font-mono text-[9px] text-accent tracking-wider uppercase">active</span>
        )}
      </div>

      {/* Logo pill — always visible */}
      <div className="absolute top-0 left-0 z-10 pointer-events-none pt-3 pl-4">
        <div className="flex items-center gap-2 shrink-0 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2">
          <Image src="/assets/cutm-logo-bg.png" alt="CUTM" width={28} height={28} className="object-contain" />
          <div className="w-px h-5 bg-white/20" />
          <PanoMark className="h-6 w-6" style={{ color: '#f5f0e6' }} />
          <span className="font-display font-bold text-sm text-white/90 tracking-wide">PanoStitch</span>
        </div>
      </div>

      {/* Overlay — fades in/out */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{ opacity: overlayVisible ? 1 : 0 }}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-auto flex items-center px-4 pt-2 gap-3">
          {/* Spacer to push controls past the always-visible logo */}
          <div className="shrink-0" style={{ width: 172 }} />
          <div className="flex flex-col min-w-0">
            <p className="font-display font-bold text-base text-white leading-tight truncate">
              {project?.name}
            </p>
            <p className="font-mono text-xs text-white/60 truncate">{currentScene.name}</p>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1 shrink-0">
            <TourButton onClick={() => setAutoRotate((a) => !a)} title="Toggle auto-rotate" active={autoRotate}>
              <RotateCcw className="h-4 w-4" />
            </TourButton>
            <TourButton onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </TourButton>
            <TourButton onClick={() => router.push(`/projects/${id}`)} title="Exit tour">
              <X className="h-4 w-4" />
            </TourButton>
          </div>
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Scene strip — bottom center */}
        <div className="absolute bottom-3 left-0 right-0 pointer-events-auto flex items-end justify-center gap-2 px-3">
          <TourButton onClick={navigatePrev} disabled={currentIndex === 0} title="Previous scene">
            <ChevronLeft className="h-4 w-4" />
          </TourButton>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar max-w-[min(90vw,760px)] px-1 py-1">
            {scenes.map((scene, i) => (
              <SceneThumb
                key={scene.id}
                scene={scene}
                index={i}
                isCurrent={scene.id === currentScene.id}
                onClick={() => navigateTo(scene)}
              />
            ))}
          </div>
          <TourButton onClick={navigateNext} disabled={currentIndex === scenes.length - 1} title="Next scene">
            <ChevronRight className="h-4 w-4" />
          </TourButton>
        </div>
      </div>


    </div>
  )
}

// ── Tour icon button ──────────────────────────────────────────────────────────

function TourButton({
  children,
  onClick,
  disabled,
  title,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`h-8 w-8 flex items-center justify-center rounded-[3px] border transition-colors text-ink/80 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? 'border-accent/60 bg-accent/20 text-accent'
          : 'border-ink/20 bg-black/30 hover:bg-black/50'
      }`}
    >
      {children}
    </button>
  )
}

// ── Scene thumbnail in strip ──────────────────────────────────────────────────

function SceneThumb({ scene, index, isCurrent, onClick }: {
  scene: Scene; index: number; isCurrent: boolean; onClick: () => void
}) {
  const thumbUrl = useBlobUrl(scene.thumbnailBlobId)
  return (
    <button
      onClick={onClick}
      title={scene.name}
      className="shrink-0 flex flex-col items-center gap-1.5 group"
    >
      <div className={`w-28 h-[68px] sm:w-32 sm:h-20 rounded-[4px] overflow-hidden border-2 transition-colors shadow-lg ${
        isCurrent ? 'border-accent shadow-accent/20' : 'border-white/20 hover:border-white/50'
      }`}>
        {thumbUrl ? (
          <img src={thumbUrl} alt={scene.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-black/60 flex items-center justify-center">
            <span className="font-mono text-xs text-white/40">{String(index + 1).padStart(2, '0')}</span>
          </div>
        )}
      </div>
      <span className={`font-mono text-[10px] sm:text-[11px] tracking-wider max-w-[112px] truncate ${
        isCurrent ? 'text-accent font-medium' : 'text-white/60 group-hover:text-white/90'
      }`}>
        {scene.name}
      </span>
    </button>
  )
}
