/// <reference lib="webworker" />

/**
 * PanoStitch stitcher Web Worker — v4
 *
 * Primary matching: Harris corner detection + normalized 8×8 patch descriptors
 * + Lowe ratio test + 1-D RANSAC for horizontal translation.  RANSAC rejects
 * false matches that arise from repeated visual patterns (identical AC units,
 * orange wall segments, "ME TO WE" signage appearing in two adjacent images),
 * which caused NCC to pick wrong overlap widths in v3.
 *
 * Fallback: Sobel-edge NCC on cylindrically-warped thumbnails (v3 approach),
 * used only when Harris finds too few corners (near-uniform images).
 *
 * Compositing pipeline unchanged from v3.
 */

import Dexie from 'dexie'
import { nanoid } from 'nanoid'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StitchRequest = {
  type: 'stitch'
  jobId: string
  blobIds: string[]
  maxDimension: number
}

export type StitchErrorCode =
  | 'insufficient-overlap'
  | 'no-features'
  | 'memory'
  | 'opencv-failed'
  | 'invalid-input'
  | 'unknown'

export type WorkerOutMessage =
  | { type: 'progress'; jobId: string; stage: string; pct: number; detail?: string }
  | {
      type: 'success'
      jobId: string
      panoramaBlobId: string
      thumbnailBlobId: string
      previewBlobId: string
      haov: number
      vaov: number
      durationMs: number
    }
  | {
      type: 'error'
      jobId: string
      code: StitchErrorCode
      message: string
      problemImageIndices?: number[]
    }

// ── DB ────────────────────────────────────────────────────────────────────────

class WorkerDB extends Dexie {
  blobs!: Dexie.Table<
    { id: string; data: Blob; size: number; type: string; createdAt: Date },
    string
  >
  constructor() {
    super('PanoStitch')
    this.version(1).stores({
      projects: 'id, updatedAt',
      scenes: 'id, projectId, [projectId+order]',
      hotspots: 'id, sceneId',
      sourcePhotos: 'id, sceneId, [sceneId+order]',
      blobs: 'id, createdAt',
    })
  }
}

const db = new WorkerDB()
const self_ = self as unknown as DedicatedWorkerGlobalScope

function post(msg: WorkerOutMessage) { self_.postMessage(msg) }
function postProgress(jobId: string, stage: string, pct: number, detail?: string) {
  post({ type: 'progress', jobId, stage, pct, detail })
}
function postError(
  jobId: string,
  code: StitchErrorCode,
  message: string,
  problemImageIndices?: number[],
) {
  post({ type: 'error', jobId, code, message, problemImageIndices })
}

// ── Image utilities ───────────────────────────────────────────────────────────

async function resizeBitmap(bitmap: ImageBitmap, maxDim: number): Promise<ImageBitmap> {
  const { width, height } = bitmap
  if (Math.max(width, height) <= maxDim) return bitmap
  const scale = maxDim / Math.max(width, height)
  return createImageBitmap(bitmap, {
    resizeWidth: Math.round(width * scale),
    resizeHeight: Math.round(height * scale),
    resizeQuality: 'high',
  })
}

function bitmapToImageData(bitmap: ImageBitmap, targetWidth: number): ImageData {
  const scale = targetWidth / bitmap.width
  const w = targetWidth
  const h = Math.round(bitmap.height * scale)
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

function computeVariance(img: ImageData): number {
  const step = Math.max(1, Math.round((img.width * img.height) / 2000))
  let sum = 0, sumSq = 0, n = 0
  for (let i = 0; i < img.data.length; i += step * 4) {
    const v = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
    sum += v; sumSq += v * v; n++
  }
  const mean = sum / n
  return sumSq / n - mean * mean
}

// ── Cylindrical projection ────────────────────────────────────────────────────

function warpToCylinder(src: ImageData, focalLen: number): ImageData {
  const W = src.width, H = src.height
  const cx = W / 2, cy = H / 2
  const dst = new ImageData(W, H)

  for (let oy = 0; oy < H; oy++) {
    for (let ox = 0; ox < W; ox++) {
      const theta = (ox - cx) / focalLen
      const tanT  = Math.tan(theta)
      const h     = (oy - cy) / focalLen
      const sx    = focalLen * tanT + cx
      const sy    = h * Math.sqrt(1 + tanT * tanT) * focalLen + cy

      const x0 = sx | 0, y0 = sy | 0
      if (x0 < 0 || x0 >= W - 1 || y0 < 0 || y0 >= H - 1) continue

      const dx = sx - x0, dy_ = sy - y0
      const dstIdx = (oy * W + ox) * 4

      for (let c = 0; c < 3; c++) {
        const tl = src.data[(y0       * W + x0    ) * 4 + c]
        const tr = src.data[(y0       * W + x0 + 1) * 4 + c]
        const bl = src.data[((y0 + 1) * W + x0    ) * 4 + c]
        const br = src.data[((y0 + 1) * W + x0 + 1) * 4 + c]
        dst.data[dstIdx + c] =
          (tl * (1 - dx) * (1 - dy_) + tr * dx * (1 - dy_) +
           bl * (1 - dx) * dy_       + br * dx * dy_ + 0.5) | 0
      }
      dst.data[dstIdx + 3] = 255
    }
  }
  return dst
}

// ── Sobel edge map (used only for NCC fallback) ───────────────────────────────

function sobelEdge(src: ImageData): ImageData {
  const W = src.width, H = src.height
  const dst = new ImageData(W, H)
  const luma = (x: number, y: number) => {
    const i = (y * W + x) * 4
    return 0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2]
  }
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const gx =
        -luma(x - 1, y - 1) + luma(x + 1, y - 1) +
        -2 * luma(x - 1, y) + 2 * luma(x + 1, y) +
        -luma(x - 1, y + 1) + luma(x + 1, y + 1)
      const gy =
        -luma(x - 1, y - 1) - 2 * luma(x, y - 1) - luma(x + 1, y - 1) +
         luma(x - 1, y + 1) + 2 * luma(x, y + 1) + luma(x + 1, y + 1)
      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy))
      const idx = (y * W + x) * 4
      dst.data[idx] = dst.data[idx + 1] = dst.data[idx + 2] = mag
      dst.data[idx + 3] = 255
    }
  }
  return dst
}

// ── NCC (fallback when Harris finds too few corners) ──────────────────────────

function ncc1D(imgA: ImageData, imgB: ImageData, overlapW: number): number {
  const startXA = imgA.width - overlapW
  const H = Math.min(imgA.height, imgB.height)
  const stepY = Math.max(1, Math.round(H / 40))
  const stepX = Math.max(1, Math.round(overlapW / 50))

  let sumA = 0, sumB = 0, sumAA = 0, sumBB = 0, sumAB = 0, n = 0
  for (let y = 1; y < H - 1; y += stepY) {
    const rowA = y * imgA.width * 4
    const rowB = y * imgB.width * 4
    for (let x = 0; x < overlapW; x += stepX) {
      const xA = startXA + x
      if (xA >= imgA.width || x >= imgB.width) break
      const vA = imgA.data[rowA + xA * 4]
      const vB = imgB.data[rowB + x * 4]
      sumA += vA; sumB += vB; sumAA += vA * vA; sumBB += vB * vB; sumAB += vA * vB
      n++
    }
  }
  if (n < 8) return 0
  const mA = sumA / n, mB = sumB / n
  const varA = sumAA / n - mA * mA
  const varB = sumBB / n - mB * mB
  if (varA < 1 || varB < 1) return 0
  return (sumAB / n - mA * mB) / Math.sqrt(varA * varB)
}

function findBestOffsetNCC(cylA: ImageData, cylB: ImageData): { dx: number; score: number } {
  const edgeA = sobelEdge(cylA)
  const edgeB = sobelEdge(cylB)
  const W = edgeA.width
  const minOv = Math.round(W * 0.08)
  const maxOv = Math.round(W * 0.82)
  const coarseStep = Math.max(1, Math.round(W * 0.03))

  let bestOv = Math.round(W * 0.35), bestScore = -Infinity
  for (let ov = minOv; ov <= maxOv; ov += coarseStep) {
    const s = ncc1D(edgeA, edgeB, ov)
    if (s > bestScore) { bestScore = s; bestOv = ov }
  }
  const fineStep = Math.max(1, Math.round(W * 0.01))
  const fineRange = coarseStep * 2
  for (
    let ov = Math.max(minOv, bestOv - fineRange);
    ov <= Math.min(maxOv, bestOv + fineRange);
    ov += fineStep
  ) {
    const s = ncc1D(edgeA, edgeB, ov)
    if (s > bestScore) { bestScore = s; bestOv = ov }
  }
  return { dx: W - bestOv, score: Math.max(0, bestScore) }
}

// ── Harris corner detection ───────────────────────────────────────────────────

const PATCH_HALF = 4   // descriptor patch is 8×8 = 64 floats
const CORNER_MARGIN = PATCH_HALF + 3

function detectHarrisCorners(img: ImageData, maxN: number): { x: number; y: number }[] {
  const W = img.width, H = img.height
  const n = W * H

  // Greyscale
  const grey = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    grey[i] = 0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2]
  }

  // Sobel gradients
  const Ix = new Float32Array(n)
  const Iy = new Float32Array(n)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      Ix[i] =
        -grey[(y - 1) * W + x - 1] + grey[(y - 1) * W + x + 1] +
        -2 * grey[y * W + x - 1]   + 2 * grey[y * W + x + 1]   +
        -grey[(y + 1) * W + x - 1] + grey[(y + 1) * W + x + 1]
      Iy[i] =
        -grey[(y - 1) * W + x - 1] - 2 * grey[(y - 1) * W + x] - grey[(y - 1) * W + x + 1] +
         grey[(y + 1) * W + x - 1] + 2 * grey[(y + 1) * W + x] + grey[(y + 1) * W + x + 1]
    }
  }

  // Structure tensor with 3×3 box filter + Harris response
  const k = 0.04
  const R = new Float32Array(n)
  let maxR = 0
  const m = CORNER_MARGIN

  for (let y = m; y < H - m; y++) {
    for (let x = m; x < W - m; x++) {
      let sxx = 0, syy = 0, sxy = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = (y + dy) * W + (x + dx)
          sxx += Ix[i] * Ix[i]
          syy += Iy[i] * Iy[i]
          sxy += Ix[i] * Iy[i]
        }
      }
      const det = sxx * syy - sxy * sxy
      const tr  = sxx + syy
      const r   = det - k * tr * tr
      R[y * W + x] = r
      if (r > maxR) maxR = r
    }
  }

  // Collect candidates above 1 % of peak response
  const thr = maxR * 0.01
  const cands: { x: number; y: number; r: number }[] = []
  for (let y = m; y < H - m; y++) {
    for (let x = m; x < W - m; x++) {
      if (R[y * W + x] > thr) cands.push({ x, y, r: R[y * W + x] })
    }
  }
  cands.sort((a, b) => b.r - a.r)

  // Greedy NMS with radius 5
  const picked: { x: number; y: number }[] = []
  const suppressed = new Uint8Array(n)
  const NMS_R = 5

  for (const c of cands) {
    if (picked.length >= maxN) break
    if (suppressed[c.y * W + c.x]) continue
    picked.push({ x: c.x, y: c.y })
    for (let dy = -NMS_R; dy <= NMS_R; dy++) {
      for (let dx = -NMS_R; dx <= NMS_R; dx++) {
        const ny = c.y + dy, nx = c.x + dx
        if (ny >= 0 && ny < H && nx >= 0 && nx < W) suppressed[ny * W + nx] = 1
      }
    }
  }
  return picked
}

// ── Normalized patch descriptor (8×8 = 64 floats, zero-mean unit-variance) ────

const DESC_LEN = (2 * PATCH_HALF) * (2 * PATCH_HALF)  // 64

function patchDesc(img: ImageData, x: number, y: number): Float32Array {
  const W = img.width
  const desc = new Float32Array(DESC_LEN)
  let mean = 0
  let k = 0

  for (let dy = -PATCH_HALF; dy < PATCH_HALF; dy++) {
    for (let dx = -PATCH_HALF; dx < PATCH_HALF; dx++) {
      const i = ((y + dy) * W + (x + dx)) * 4
      const v = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
      desc[k++] = v
      mean += v
    }
  }
  mean /= DESC_LEN
  let std = 0
  for (let i = 0; i < DESC_LEN; i++) { desc[i] -= mean; std += desc[i] * desc[i] }
  std = Math.sqrt(std / DESC_LEN) || 1
  for (let i = 0; i < DESC_LEN; i++) desc[i] /= std
  return desc
}

// ── Feature matching + 1-D RANSAC ────────────────────────────────────────────

/**
 * Match two cylindrically-warped thumbnail images using Harris corners,
 * normalized patch descriptors, Lowe's ratio test, and 1-D RANSAC for the
 * horizontal translation.
 *
 * Returns null when corners are too sparse (caller falls back to NCC).
 *
 * Key insight: dx = cornerA.x − cornerB.x for any correct match.  RANSAC
 * finds the translation supported by the most matches — repeated patterns
 * give inconsistent dx values and are automatically rejected.
 */
function matchPairFeatures(
  cylA: ImageData,
  cylB: ImageData,
): { dx: number; score: number } | null {
  const W = cylA.width

  const cornersA = detectHarrisCorners(cylA, 250)
  const cornersB = detectHarrisCorners(cylB, 250)
  if (cornersA.length < 6 || cornersB.length < 6) return null

  const descA = cornersA.map(c => patchDesc(cylA, c.x, c.y))
  const descB = cornersB.map(c => patchDesc(cylB, c.x, c.y))

  // Brute-force match with Lowe ratio test on SSD of normalized descriptors.
  // For normalized unit-variance patches, SSD in [0, 2]; ratio² = 0.75² = 0.5625.
  const RATIO_SQ = 0.5625
  const candidateDxs: number[] = []

  for (let a = 0; a < descA.length; a++) {
    let best = Infinity, second = Infinity, bestB = -1
    for (let b = 0; b < descB.length; b++) {
      let ssd = 0
      for (let k = 0; k < DESC_LEN; k++) {
        const d = descA[a][k] - descB[b][k]
        ssd += d * d
      }
      if (ssd < best)       { second = best; best = ssd; bestB = b }
      else if (ssd < second) { second = ssd }
    }
    if (bestB >= 0 && best < RATIO_SQ * second) {
      candidateDxs.push(cornersA[a].x - cornersB[bestB].x)
    }
  }

  if (candidateDxs.length < 4) return null

  // 1-D RANSAC: each sample is one match → one candidate translation.
  const INLIER_THR = 5  // px tolerance in thumbnail space
  let bestDx = W * 0.6, bestInliers = 0

  for (let iter = 0; iter < 200; iter++) {
    const cand = candidateDxs[Math.floor(Math.random() * candidateDxs.length)]
    let inliers = 0
    for (const d of candidateDxs) {
      if (Math.abs(d - cand) <= INLIER_THR) inliers++
    }
    if (inliers > bestInliers) { bestInliers = inliers; bestDx = cand }
  }

  // Refine: mean of inliers
  { let sum = 0, cnt = 0
    for (const d of candidateDxs) {
      if (Math.abs(d - bestDx) <= INLIER_THR) { sum += d; cnt++ }
    }
    if (cnt > 0) bestDx = sum / cnt
  }

  const minDx = W * 0.08
  const maxDx = W * 0.92
  if (bestDx < minDx || bestDx > maxDx || bestInliers < 3) return null

  return { dx: Math.round(bestDx), score: Math.min(1, bestInliers / 12) }
}

// ── Unified offset finder (Harris primary, NCC fallback) ─────────────────────

function findBestOffset(cylA: ImageData, cylB: ImageData): { dx: number; score: number } {
  const feat = matchPairFeatures(cylA, cylB)
  if (feat) return feat
  return findBestOffsetNCC(cylA, cylB)
}

// ── Outlier rejection ─────────────────────────────────────────────────────────

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function rejectOutliers(
  offsets: { dx: number; score: number }[],
): { dx: number; score: number }[] {
  if (offsets.length < 3) return offsets
  const dxArr = offsets.map((o) => o.dx)
  const med   = median(dxArr)
  const mad   = median(dxArr.map((v) => Math.abs(v - med))) || 1

  return offsets.map((o) => {
    // Only replace NCC-quality matches that deviate strongly from consensus
    const isOutlier = o.score < 0.25 && Math.abs(o.dx - med) > 2.0 * mad
    return isOutlier ? { dx: med, score: o.score } : o
  })
}

// ── FOV estimation ────────────────────────────────────────────────────────────

function estimateFov(panoramaW: number, panoramaH: number, singleW: number): { haov: number; vaov: number } {
  const haov = Math.min(340, Math.max(20, Math.round((panoramaW / singleW) * 65)))
  const vaov = Math.min(150, Math.max(40, Math.round(haov / (panoramaW / panoramaH))))
  return { haov, vaov }
}

// ── Panorama compositing ──────────────────────────────────────────────────────

async function composePanorama(
  bitmaps: ImageBitmap[],
  thumbOffsets: { dx: number }[],
  thumbWidth: number,
): Promise<Blob> {
  const VCROP = 0.15

  const absX: number[] = [0]
  for (let i = 0; i < thumbOffsets.length; i++) {
    const scale = bitmaps[i].width / thumbWidth
    absX.push(absX[i] + Math.round(thumbOffsets[i].dx * scale))
  }

  const minH  = Math.min(...bitmaps.map((b) => b.height))
  const cropY = Math.round(minH * VCROP)
  const cropH = minH - 2 * cropY

  const canvasW = Math.max(...bitmaps.map((b, i) => absX[i] + b.width))

  if (canvasW > 32768 || cropH > 16384) {
    throw Object.assign(
      new Error(`Panorama canvas (${canvasW}×${cropH}) exceeds browser limits`),
      { code: 'memory' as StitchErrorCode },
    )
  }

  const canvas = new OffscreenCanvas(canvasW, cropH)
  const ctx    = canvas.getContext('2d')!

  for (let i = 0; i < bitmaps.length; i++) {
    const bm   = bitmaps[i]
    const dstX = absX[i]
    const srcY = Math.round(bm.height * VCROP)
    const srcH = bm.height - 2 * Math.round(bm.height * VCROP)

    if (i === 0) {
      ctx.drawImage(bm, 0, srcY, bm.width, srcH, dstX, 0, bm.width, srcH)
      continue
    }

    const prevRight = absX[i - 1] + bitmaps[i - 1].width
    const blendW    = Math.max(0, prevRight - dstX)

    if (blendW < bm.width) {
      ctx.drawImage(
        bm, blendW, srcY, bm.width - blendW, srcH,
        dstX + blendW, 0, bm.width - blendW, srcH,
      )
    }

    if (blendW <= 0) continue

    const existingData = ctx.getImageData(dstX, 0, blendW, cropH)
    const blendCanvas  = new OffscreenCanvas(blendW, cropH)
    const bc = blendCanvas.getContext('2d')!
    bc.drawImage(bm, 0, srcY, blendW, srcH, 0, 0, blendW, cropH)
    const newData = bc.getImageData(0, 0, blendW, cropH)

    for (let py = 0; py < cropH; py++) {
      const row = py * blendW * 4
      for (let px = 0; px < blendW; px++) {
        const t   = px / blendW
        const idx = row + px * 4
        existingData.data[idx]     = (existingData.data[idx]     * (1 - t) + newData.data[idx]     * t + 0.5) | 0
        existingData.data[idx + 1] = (existingData.data[idx + 1] * (1 - t) + newData.data[idx + 1] * t + 0.5) | 0
        existingData.data[idx + 2] = (existingData.data[idx + 2] * (1 - t) + newData.data[idx + 2] * t + 0.5) | 0
        existingData.data[idx + 3] = 255
      }
    }
    ctx.putImageData(existingData, dstX, 0)
  }

  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 })
}

// ── Preview (2048px, q=0.55) ──────────────────────────────────────────────────

async function createPreviewBlobWorker(blob: Blob): Promise<Blob> {
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

// ── Thumbnail ─────────────────────────────────────────────────────────────────

async function createThumbnail(panoramaBlob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(panoramaBlob)
  const TW = 400, TH = 200
  const srcAspect = bitmap.width / bitmap.height
  const tgtAspect = TW / TH
  let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height
  if (srcAspect > tgtAspect) {
    sw = Math.round(bitmap.height * tgtAspect)
    sx = Math.round((bitmap.width - sw) / 2)
  } else {
    sh = Math.round(bitmap.width / tgtAspect)
    sy = Math.round((bitmap.height - sh) / 2)
  }
  const canvas = new OffscreenCanvas(TW, TH)
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, TW, TH)
  bitmap.close()
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.78 })
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

const THUMB_W     = 300
const FOCAL_RATIO = 0.785  // f = W × 0.785 ≈ 65° horizontal FOV

async function runStitch(req: StitchRequest) {
  const { jobId, blobIds, maxDimension } = req
  const t0 = Date.now()

  postProgress(jobId, 'loading-cv', 100, 'Engine ready')

  // ── Stage 2: decode ────────────────────────────────────────────────────────
  postProgress(jobId, 'decoding', 0, `Loading ${blobIds.length} images`)
  const bitmaps: ImageBitmap[] = []
  const problemIndices: number[] = []

  for (let i = 0; i < blobIds.length; i++) {
    const record = await db.blobs.get(blobIds[i])
    if (!record) { postError(jobId, 'invalid-input', `Image ${i + 1} not found.`); return }
    try {
      const raw = await createImageBitmap(record.data)
      const bm  = await resizeBitmap(raw, maxDimension)
      if (bm !== raw) raw.close()
      bitmaps.push(bm)
    } catch {
      problemIndices.push(i)
    }
    postProgress(jobId, 'decoding', Math.round(((i + 1) / blobIds.length) * 100),
      `Decoded ${i + 1} / ${blobIds.length}`)
  }

  if (bitmaps.length < 2) {
    postError(jobId, 'invalid-input',
      `Need at least 2 images; ${blobIds.length - bitmaps.length} could not be decoded.`,
      problemIndices)
    return
  }

  // ── Stage 3: prepare thumbnails ───────────────────────────────────────────
  postProgress(jobId, 'features', 0, 'Preparing alignment maps')

  const rawThumbs  = bitmaps.map((b) => bitmapToImageData(b, THUMB_W))
  const focalLen   = THUMB_W * FOCAL_RATIO
  // Cylindrical warp: used by both Harris (primary) and Sobel-NCC (fallback)
  const cylThumbs  = rawThumbs.map((t) => warpToCylinder(t, focalLen))

  postProgress(jobId, 'features', 60, 'Checking textures')

  const lowVar = rawThumbs
    .map((t, i) => (computeVariance(t) < 25 ? i : -1))
    .filter((i) => i >= 0)
  if (lowVar.length === rawThumbs.length) {
    postError(jobId, 'no-features', 'All images appear near-uniform.', lowVar)
    return
  }
  postProgress(jobId, 'features', 100, 'Alignment maps ready')

  // ── Stage 4: matching ──────────────────────────────────────────────────────
  postProgress(jobId, 'matching', 0, `Aligning ${bitmaps.length - 1} pairs`)

  const rawOffsets: { dx: number; score: number }[] = []
  for (let i = 0; i < bitmaps.length - 1; i++) {
    const { dx, score } = findBestOffset(cylThumbs[i], cylThumbs[i + 1])
    const method = score > 0.25 ? 'feat' : 'ncc'
    rawOffsets.push({ dx, score })
    postProgress(jobId, 'matching',
      Math.round(((i + 1) / (bitmaps.length - 1)) * 100),
      `Pair ${i + 1}/${bitmaps.length - 1} — ${method} confidence ${Math.round(score * 100)}%`)
  }

  const offsets  = rejectOutliers(rawOffsets)
  const avgScore = offsets.reduce((a, b) => a + b.score, 0) / offsets.length

  if (avgScore < 0.10) {
    postError(jobId, 'insufficient-overlap',
      `Average alignment confidence too low (${Math.round(avgScore * 100)}%). ` +
      `Ensure 30–50 % overlap between photos and shoot in good light.`)
    return
  }

  // ── Stage 5: composite ─────────────────────────────────────────────────────
  postProgress(jobId, 'blending', 0, 'Compositing panorama')
  let panoramaBlob: Blob
  try {
    panoramaBlob = await composePanorama(bitmaps, offsets, THUMB_W)
  } catch (err) {
    const code: StitchErrorCode =
      err instanceof Error && (err as Error & { code?: string }).code === 'memory'
        ? 'memory' : 'unknown'
    postError(jobId, code, err instanceof Error ? err.message : String(err))
    return
  }
  postProgress(jobId, 'blending', 100, 'Panorama composed')

  // ── Stage 6: thumbnail + preview + save ───────────────────────────────────
  postProgress(jobId, 'thumbnail', 0, 'Generating thumbnail')
  const [thumbnailBlob, previewBlob] = await Promise.all([
    createThumbnail(panoramaBlob),
    createPreviewBlobWorker(panoramaBlob),
  ])
  postProgress(jobId, 'thumbnail', 50, 'Saving')

  const panoramaBlobId  = nanoid()
  const thumbnailBlobId = nanoid()
  const previewBlobId   = nanoid()

  await db.blobs.bulkAdd([
    { id: panoramaBlobId,  data: panoramaBlob,  size: panoramaBlob.size,  type: 'image/jpeg', createdAt: new Date() },
    { id: thumbnailBlobId, data: thumbnailBlob, size: thumbnailBlob.size, type: 'image/jpeg', createdAt: new Date() },
    { id: previewBlobId,   data: previewBlob,   size: previewBlob.size,   type: 'image/jpeg', createdAt: new Date() },
  ])

  const pBitmap = await createImageBitmap(panoramaBlob)
  const { haov, vaov } = estimateFov(pBitmap.width, pBitmap.height, bitmaps[0].width)
  pBitmap.close()

  for (const bm of bitmaps) bm.close()
  postProgress(jobId, 'thumbnail', 100, 'Done')

  post({
    type: 'success',
    jobId,
    panoramaBlobId,
    thumbnailBlobId,
    previewBlobId,
    haov,
    vaov,
    durationMs: Date.now() - t0,
  })
}

self_.onmessage = async (e: MessageEvent<StitchRequest>) => {
  const req = e.data
  if (req.type !== 'stitch') return
  try { await runStitch(req) } catch (err) {
    postError(req.jobId, 'unknown', err instanceof Error ? err.message : String(err))
  }
}
