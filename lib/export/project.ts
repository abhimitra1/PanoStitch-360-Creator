import JSZip from 'jszip'
import { db } from '@/lib/db/schema'
import type { Project, Scene, Hotspot, SourcePhoto } from '@/lib/db/schema'

export interface PanoStitchManifest {
  format: 'panostitch'
  version: 1
  exportedAt: string
  projectName: string
  stats: {
    scenes: number
    hotspots: number
    sourcePhotos: number
    totalBytes: number
  }
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function mimeToExt(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin'
}

export async function exportProject(
  projectId: string,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  onProgress?.(0)

  // 1. Load all records
  const project = await db.projects.get(projectId)
  if (!project) throw new Error('Project not found')

  const scenes = await db.scenes.where('projectId').equals(projectId).toArray()
  const sceneIds = scenes.map((s) => s.id)

  const [hotspots, sourcePhotos] = await Promise.all([
    sceneIds.length ? db.hotspots.where('sceneId').anyOf(sceneIds).toArray() : [],
    sceneIds.length ? db.sourcePhotos.where('sceneId').anyOf(sceneIds).toArray() : [],
  ])

  onProgress?.(10)

  // 2. Collect all blob IDs
  const blobIds = new Set<string>()
  for (const scene of scenes) {
    blobIds.add(scene.panoramaBlobId)
    blobIds.add(scene.thumbnailBlobId)
  }
  for (const sp of sourcePhotos) {
    blobIds.add(sp.blobId)
  }

  // 3. Load blobs from Dexie
  const blobRecords = await db.blobs.bulkGet([...blobIds])
  const blobMap = new Map(blobRecords.filter(Boolean).map((r) => [r!.id, r!]))

  onProgress?.(20)

  // 4. Build zip
  const zip = new JSZip()

  // JSON records (strip undefined fields for clean JSON)
  const cleanProject: Project = { ...project }
  const manifest: PanoStitchManifest = {
    format: 'panostitch',
    version: 1,
    exportedAt: new Date().toISOString(),
    projectName: project.name,
    stats: {
      scenes: scenes.length,
      hotspots: hotspots.length,
      sourcePhotos: sourcePhotos.length,
      totalBytes: [...blobMap.values()].reduce((sum, b) => sum + b.size, 0),
    },
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('project.json', JSON.stringify(cleanProject, null, 2))
  zip.file('scenes.json', JSON.stringify(scenes, null, 2))
  zip.file('hotspots.json', JSON.stringify(hotspots, null, 2))
  zip.file('sourcePhotos.json', JSON.stringify(sourcePhotos, null, 2))

  // Blobs as binary files
  const blobFolder = zip.folder('blobs')!
  const blobEntries = [...blobMap.entries()]
  for (let i = 0; i < blobEntries.length; i++) {
    const [blobId, record] = blobEntries[i]
    const ext = mimeToExt(record.type)
    const arrayBuffer = await record.data.arrayBuffer()
    blobFolder.file(`${blobId}.${ext}`, arrayBuffer)
    onProgress?.(20 + Math.round((i / blobEntries.length) * 70))
  }

  onProgress?.(90)

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } })

  onProgress?.(100)
  return zipBlob
}

export function exportFilename(projectName: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const safe = projectName.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40)
  return `${safe}-${date}.panostitch`
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
