'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getBlobAsUrl, revokeUrl } from '@/lib/db/blobs'
import { Button } from '@/components/ui/button'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

interface PhotoItem {
  blobId: string
  filename: string
}

interface ThumbGridProps {
  photos: PhotoItem[]
  onRemove: (blobId: string) => void
}

function PhotoThumb({ blobId, index, filename, onRemove }: {
  blobId: string
  index: number
  filename: string
  onRemove: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    getBlobAsUrl(blobId).then((u) => {
      objectUrl = u ?? null
      setUrl(objectUrl)
    })
    return () => {
      if (objectUrl) revokeUrl(objectUrl)
    }
  }, [blobId])

  return (
    <div className="group relative aspect-square bg-surface border border-line rounded-[4px] overflow-hidden">
      {url ? (
        <img src={url} alt={filename} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="h-5 w-5 border-2 border-ink-faint border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {/* Badge */}
      <div className="absolute top-1.5 left-1.5">
        <span className="font-mono text-[10px] text-ink-faint bg-background/80 px-1 py-0.5 rounded">
          {pad(index + 1)}
        </span>
      </div>
      {/* Remove */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-background/70 hover:bg-background/90 text-ink transition-opacity"
        onClick={onRemove}
        aria-label={`Remove photo ${index + 1}`}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function ThumbGrid({ photos, onRemove }: ThumbGridProps) {
  if (photos.length === 0) return null

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {photos.map((photo, i) => (
        <PhotoThumb
          key={photo.blobId}
          blobId={photo.blobId}
          index={i}
          filename={photo.filename}
          onRemove={() => onRemove(photo.blobId)}
        />
      ))}
    </div>
  )
}
