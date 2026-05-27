'use client'

import { use, useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import { ArrowLeft, Camera, Upload } from 'lucide-react'
import { db } from '@/lib/db/schema'
import { storeBlob } from '@/lib/db/blobs'
import { reencodeImage, createPreviewBlob } from '@/lib/utils/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  params: Promise<{ id: string }>
}

interface FileInfo {
  file: File
  previewUrl: string
  width: number
  height: number
}

export function Import360Client({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()

  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [sceneName, setSceneName] = useState('')
  const [haov, setHaov] = useState(360)
  const [vaov, setVaov] = useState(180)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    setError('')

    const previewUrl = URL.createObjectURL(f)
    const img = new Image()

    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.src = previewUrl
    })

    const w = img.naturalWidth
    const h = img.naturalHeight
    const ratio = w / h

    // Detect panorama type from aspect ratio.
    let detectedHaov = 360
    let detectedVaov = 180
    if (Math.abs(ratio - 2) > 0.15) {
      if (ratio > 2) {
        detectedHaov = Math.min(360, Math.round(ratio * 90))
        detectedVaov = 180
      } else {
        detectedHaov = 360
        detectedVaov = Math.min(180, Math.round((1 / ratio) * 90))
      }
    }

    setFileInfo({ file: f, previewUrl, width: w, height: h })
    setHaov(detectedHaov)
    setVaov(detectedVaov)

    const baseName = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
    setSceneName(baseName.charAt(0).toUpperCase() + baseName.slice(1))
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handleImport = async () => {
    if (!fileInfo) return
    setImporting(true)
    setError('')

    try {
      // Determine order (append after existing scenes).
      const existing = await db.scenes
        .where('[projectId+order]')
        .between([id, -Infinity], [id, Infinity])
        .toArray()
      const order = existing.length

      // Re-encode original to JPEG q=0.88 (50–70% smaller, no perceptible loss).
      const panoBlob = await reencodeImage(fileInfo.file)
      const panoId = await storeBlob(panoBlob, 'image/jpeg')

      // Generate 2048px preview at q=0.55 for fast initial load in the viewer.
      const previewBlob = await createPreviewBlob(fileInfo.file)
      const previewId = await storeBlob(previewBlob, 'image/jpeg')

      // Generate a 480×240 thumbnail.
      const canvas = document.createElement('canvas')
      canvas.width = 480
      canvas.height = 240
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.src = fileInfo.previewUrl
      })
      ctx.drawImage(img, 0, 0, 480, 240)
      const thumbBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.82)
      )
      const thumbId = await storeBlob(thumbBlob, 'image/jpeg')

      const sceneId = nanoid()
      const now = new Date()

      await db.transaction('rw', [db.scenes, db.projects], async () => {
        await db.scenes.add({
          id: sceneId,
          projectId: id,
          name: sceneName.trim() || 'Untitled scene',
          panoramaBlobId: panoId,
          thumbnailBlobId: thumbId,
          previewBlobId: previewId,
          haov,
          vaov,
          initialYaw: 0,
          initialPitch: 0,
          initialHfov: 75,
          order,
          createdAt: now,
        })
        await db.projects.update(id, { updatedAt: now })
      })

      router.push(`/projects/${id}/scenes/${sceneId}/edit`)
    } catch (e) {
      console.error(e)
      setError('Import failed — please try again.')
      setImporting(false)
    }
  }

  const isFullEquirect = haov >= 360 && vaov >= 180

  return (
    <div className="px-6 sm:px-12 py-12 max-w-2xl mx-auto">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="mb-8 -ml-2">
        <Link href={`/projects/${id}`}>
          <ArrowLeft className="h-4 w-4" />
          back to project
        </Link>
      </Button>

      <h1 className="font-display font-bold text-3xl text-ink mb-2">Import 360° image</h1>
      <p className="text-sm text-ink-dim mb-10">
        Drop an equirectangular JPEG or PNG from Insta360, Ricoh Theta, GoPro Max, or any
        360° camera app. The image is stored locally — nothing is uploaded.
      </p>

      {!fileInfo ? (
        /* ── Drop zone ──────────────────────────────────────────────────── */
        <div
          className={`border-2 border-dashed rounded-[4px] p-16 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-accent bg-accent/5'
              : 'border-line hover:border-accent/50 hover:bg-surface'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <Camera className="h-10 w-10 text-ink-faint mx-auto mb-4" />
          <p className="font-display font-bold text-xl text-ink-dim mb-2">
            Drop your 360° image here
          </p>
          <p className="text-xs text-ink-faint mb-6">or click to browse</p>
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>
            <Upload className="h-3.5 w-3.5" />
            Browse files
          </Button>
          <p className="text-[11px] text-ink-faint mt-4">JPEG · PNG · WebP</p>
        </div>
      ) : (
        /* ── Preview + settings ─────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Image preview */}
          <div className="aspect-[2/1] rounded-[4px] overflow-hidden border border-line bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileInfo.previewUrl}
              alt="360° preview"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Detected metadata */}
          <div className="flex items-center gap-3 font-mono text-[11px] text-ink-faint">
            <span>{fileInfo.width} × {fileInfo.height}px</span>
            <span className="text-line">·</span>
            <span>{(fileInfo.file.size / 1024 / 1024).toFixed(1)} MB</span>
            <span className="text-line">·</span>
            <span className={isFullEquirect ? 'text-success' : 'text-ink-dim'}>
              {isFullEquirect ? 'full equirectangular 360°×180°' : `${haov}°×${vaov}°`}
            </span>
          </div>

          {/* Scene name */}
          <div>
            <label className="font-mono text-[10px] tracking-widest text-ink-faint uppercase block mb-1.5">
              Scene name
            </label>
            <Input
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
              placeholder="e.g. Living Room"
              className="h-9"
              autoFocus
            />
          </div>

          {/* Manual angle override (only shown when auto-detection is non-standard) */}
          {!isFullEquirect && (
            <div className="p-4 border border-line rounded-[4px] bg-surface space-y-4">
              <p className="font-mono text-[11px] text-ink-faint">
                Image doesn&apos;t look like a standard 2:1 equirectangular. Adjust angles if needed:
              </p>
              {(
                [
                  { label: 'Horizontal field of view', value: haov, set: setHaov, min: 10, max: 360 },
                  { label: 'Vertical field of view', value: vaov, set: setVaov, min: 10, max: 180 },
                ] as const
              ).map(({ label, value, set, min, max }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-mono text-[10px] tracking-widest text-ink-faint uppercase">
                      {label}
                    </label>
                    <span className="font-mono text-xs text-ink">{value}°</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => { URL.revokeObjectURL(fileInfo.previewUrl); setFileInfo(null) }}
            >
              Choose different file
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || !sceneName.trim()}
              className="flex-1"
            >
              {importing ? 'Importing…' : 'Import scene'}
            </Button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/tiff"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
    </div>
  )
}
