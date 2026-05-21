/**
 * Lazy OpenCV.js loader for Web Worker contexts.
 *
 * NOTE: The current opencv.js build (4.12.0 standard tutorial build) does not
 * include ORB, findHomography, or the Stitcher class. This loader is kept as
 * infrastructure; the stitcher.worker.ts uses a pure-JS NCC pipeline instead.
 * When a stitching-capable build is available, drop it in /public/opencv/ and
 * uncomment the loadOpenCV call in the worker.
 */

const CACHE_NAME = 'panostitch-opencv-v4'
const OPENCV_URL = '/opencv/opencv.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CV = Record<string, any>

let singleton: Promise<CV> | null = null

export function loadOpenCV(onProgress?: (pct: number) => void): Promise<CV> {
  if (singleton) return singleton

  singleton = (async (): Promise<CV> => {
    let text: string

    // Try Cache API first (near-instant on repeat loads)
    try {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(OPENCV_URL)

      if (cached) {
        onProgress?.(85)
        text = await cached.text()
        onProgress?.(90)
      } else {
        // Fetch with streaming progress
        const response = await fetch(OPENCV_URL)
        const contentLength = Number(response.headers.get('Content-Length') ?? '0')

        if (!response.body) throw new Error('ReadableStream not supported')

        const reader = response.body.getReader()
        const chunks: Uint8Array[] = []
        let received = 0

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.byteLength
          if (contentLength > 0) {
            onProgress?.(Math.round((received / contentLength) * 80))
          }
        }

        const blob = new Blob(chunks as BlobPart[], { type: 'application/javascript' })
        text = await blob.text()

        // Persist in Cache API
        try {
          await cache.put(OPENCV_URL, new Response(text, {
            headers: { 'Content-Type': 'application/javascript' },
          }))
        } catch {
          // Cache storage might be full — non-fatal
        }

        onProgress?.(85)
      }
    } catch {
      // Cache API unavailable (e.g., private browsing) — fetch directly
      text = await fetch(OPENCV_URL).then((r) => r.text())
      onProgress?.(85)
    }

    // Execute opencv.js in the current (worker) global scope.
    // Set window = globalThis so the UMD root assignment lands correctly.
    return new Promise<CV>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any
      g.window = globalThis

      // Set Module.onRuntimeInitialized BEFORE executing the script so
      // Emscripten's async WASM loader finds our callback.
      g.Module = {
        onRuntimeInitialized() {
          onProgress?.(100)
          resolve(g.cv as CV)
        },
      }

      try {
        // eslint-disable-next-line no-new-func
        new Function(text)()
      } catch (err) {
        reject(new Error(`OpenCV script execution failed: ${err}`))
      }

      setTimeout(() => reject(new Error('OpenCV WASM initialization timed out after 60 s')), 60_000)
    })
  })()

  // Allow retry after failure
  singleton.catch(() => { singleton = null })

  return singleton
}
