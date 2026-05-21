'use client'

import { useRef, useState, useCallback } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface DropzoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function Dropzone({ onFiles, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (disabled) return
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      )
      if (files.length) onFiles(files)
    },
    [onFiles, disabled]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (files.length) onFiles(files)
      e.target.value = ''
    },
    [onFiles]
  )

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Drop photos here or click to browse"
      className={cn(
        'border border-dashed border-line rounded-[4px] flex flex-col items-center justify-center',
        'p-10 cursor-pointer transition-colors select-none',
        dragging && 'border-accent bg-accent/5',
        !dragging && !disabled && 'hover:border-ink-faint hover:bg-surface',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Upload className="h-8 w-8 text-ink-faint mb-4" />
      <p className="text-ink-dim text-sm font-medium mb-1">
        Drop photos here, or click to browse
      </p>
      <p className="font-mono text-xs text-ink-faint tracking-wide">
        jpg, png, heic · 3–30 photos recommended
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  )
}
