const UNSUPPORTED_TYPES = new Set(['image/heic', 'image/heif'])

// Re-encodes to JPEG at quality 0.88 without resizing.
// Reduces file size ~50–70% vs raw camera output with no perceptible quality loss.
export async function reencodeImage(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 })
}

// Downsizes to max 2048px and encodes at JPEG quality 0.55.
// Used as the fast-loading preview before the full texture is ready.
export async function createPreviewBlob(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const { width, height } = bitmap
  const scale = Math.min(1, 2048 / Math.max(width, height))
  const tw = Math.round(width * scale)
  const th = Math.round(height * scale)
  const canvas = new OffscreenCanvas(tw, th)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, tw, th)
  bitmap.close()
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.55 })
}

export async function resizeImage(blob: Blob, maxDimension: number): Promise<Blob> {
  if (UNSUPPORTED_TYPES.has(blob.type.toLowerCase())) {
    throw new TypeError(`Unsupported format: ${blob.type}`)
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    throw new TypeError('Image could not be decoded — file may be corrupt or an unsupported format (e.g. HEIC).')
  }
  const { width, height } = bitmap

  const scale = Math.min(1, maxDimension / Math.max(width, height))
  if (scale >= 1) {
    bitmap.close()
    return blob
  }

  const targetWidth = Math.round(width * scale)
  const targetHeight = Math.round(height * scale)

  const canvas = new OffscreenCanvas(targetWidth, targetHeight)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  bitmap.close()

  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 })
}

export async function createThumbnail(blob: Blob, width = 400, height = 200): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const srcWidth = bitmap.width
  const srcHeight = bitmap.height

  const targetAspect = width / height
  const srcAspect = srcWidth / srcHeight

  let sx = 0
  let sy = 0
  let sw = srcWidth
  let sh = srcHeight

  if (srcAspect > targetAspect) {
    sw = srcHeight * targetAspect
    sx = (srcWidth - sw) / 2
  } else {
    sh = srcWidth / targetAspect
    sy = (srcHeight - sh) / 2
  }

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)
  bitmap.close()

  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 })
}

export function estimateStorageImpact(files: File[]): string {
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
  const estimated = totalBytes * 0.6
  if (estimated < 1024 * 1024) return `~${Math.round(estimated / 1024)} kb`
  return `~${(estimated / (1024 * 1024)).toFixed(0)} mb`
}

export function estimateStitchTime(photoCount: number): string {
  const seconds = photoCount * 5
  if (seconds < 60) return `~${seconds}s`
  return `~${Math.round(seconds / 60)} min`
}

export function getAspectRatioType(width: number, height: number): {
  haov: number
  vaov: number
} {
  const ratio = width / height
  if (Math.abs(ratio - 2) < 0.3) {
    return { haov: 360, vaov: 180 }
  }
  // Cylindrical — estimate haov from ratio
  const haov = Math.min(360, Math.round(ratio * 50))
  return { haov, vaov: 120 }
}
