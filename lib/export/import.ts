import JSZip from 'jszip'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db/schema'
import type { Project, Scene, Hotspot, SourcePhoto, BlobRecord } from '@/lib/db/schema'
import type { PanoStitchManifest } from './project'

export interface ImportStats {
  scenes: number
  hotspots: number
  sourcePhotos: number
  totalBytes: number
}

const CURRENT_VERSION = 1

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export async function importProject(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ projectId: string; stats: ImportStats }> {
  onProgress?.(0)

  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  onProgress?.(5)

  // Read & validate manifest
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('Invalid .panostitch file: missing manifest.json')
  const manifest: PanoStitchManifest = JSON.parse(await manifestFile.async('string'))

  if (manifest.format !== 'panostitch') {
    throw new Error('Not a valid .panostitch file.')
  }
  if (manifest.version > CURRENT_VERSION) {
    throw new Error(`This file was exported with a newer version of PanoStitch (v${manifest.version}). Please update the app.`)
  }

  // Read JSON records
  const [projectJson, scenesJson, hotspotsJson, sourcePhotosJson] = await Promise.all([
    zip.file('project.json')!.async('string'),
    zip.file('scenes.json')!.async('string'),
    zip.file('hotspots.json')!.async('string'),
    zip.file('sourcePhotos.json')!.async('string'),
  ])

  const oldProject: Project = JSON.parse(projectJson)
  const oldScenes: Scene[] = JSON.parse(scenesJson)
  const oldHotspots: Hotspot[] = JSON.parse(hotspotsJson)
  const oldSourcePhotos: SourcePhoto[] = JSON.parse(sourcePhotosJson)

  onProgress?.(10)

  // Check quota before starting
  const estimate = await navigator.storage.estimate()
  const available = (estimate.quota ?? 0) - (estimate.usage ?? 0)
  if (available > 0 && manifest.stats.totalBytes > available * 0.9) {
    throw new Error(
      `Insufficient storage: need ~${Math.round(manifest.stats.totalBytes / 1024 / 1024)} MB but only ${Math.round(available / 1024 / 1024)} MB available. Free up space in Settings.`
    )
  }

  // Build ID remap: old → new
  const projectId = nanoid()
  const sceneIdMap = new Map<string, string>(oldScenes.map((s) => [s.id, nanoid()]))
  const hotspotIdMap = new Map<string, string>(oldHotspots.map((h) => [h.id, nanoid()]))
  const sourcePhotoIdMap = new Map<string, string>(oldSourcePhotos.map((sp) => [sp.id, nanoid()]))

  // Collect unique blob IDs from scenes + source photos
  const oldBlobIds = new Set<string>()
  for (const s of oldScenes) {
    oldBlobIds.add(s.panoramaBlobId)
    oldBlobIds.add(s.thumbnailBlobId)
  }
  for (const sp of oldSourcePhotos) {
    oldBlobIds.add(sp.blobId)
  }
  const blobIdMap = new Map<string, string>([...oldBlobIds].map((id) => [id, nanoid()]))

  // Remap records
  const newProject: Project = {
    ...oldProject,
    id: projectId,
    coverSceneId: oldProject.coverSceneId ? sceneIdMap.get(oldProject.coverSceneId) : undefined,
    createdAt: new Date(oldProject.createdAt),
    updatedAt: new Date(oldProject.updatedAt),
    lastExportedAt: oldProject.lastExportedAt ? new Date(oldProject.lastExportedAt) : undefined,
  }

  const newScenes: Scene[] = oldScenes.map((s) => ({
    ...s,
    id: sceneIdMap.get(s.id)!,
    projectId,
    panoramaBlobId: blobIdMap.get(s.panoramaBlobId)!,
    thumbnailBlobId: blobIdMap.get(s.thumbnailBlobId)!,
    createdAt: new Date(s.createdAt),
  }))

  const newHotspots: Hotspot[] = oldHotspots.map((h) => ({
    ...h,
    id: hotspotIdMap.get(h.id)!,
    sceneId: sceneIdMap.get(h.sceneId)!,
    targetSceneId: h.targetSceneId ? sceneIdMap.get(h.targetSceneId) : undefined,
  }))

  const newSourcePhotos: SourcePhoto[] = oldSourcePhotos.map((sp) => ({
    ...sp,
    id: sourcePhotoIdMap.get(sp.id)!,
    sceneId: sceneIdMap.get(sp.sceneId)!,
    blobId: blobIdMap.get(sp.blobId)!,
  }))

  onProgress?.(15)

  // Read all blobs from zip
  const blobsFolder = zip.folder('blobs')
  if (!blobsFolder) throw new Error('Invalid .panostitch file: missing blobs/ folder')

  const blobEntries: BlobRecord[] = []
  const blobFiles = blobsFolder.filter(() => true)
  for (let i = 0; i < blobFiles.length; i++) {
    const zipFile = blobFiles[i]
    const filename = zipFile.name.split('/').pop() ?? ''
    const dotIdx = filename.lastIndexOf('.')
    const oldId = dotIdx >= 0 ? filename.slice(0, dotIdx) : filename
    const ext = dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : ''
    const newId = blobIdMap.get(oldId)
    if (!newId) continue

    const arrayBuffer = await zipFile.async('arraybuffer')
    const mimeType = EXT_TO_MIME[ext] ?? 'application/octet-stream'
    const blob = new Blob([arrayBuffer], { type: mimeType })

    blobEntries.push({
      id: newId,
      data: blob,
      size: blob.size,
      type: mimeType,
      createdAt: new Date(),
    })

    onProgress?.(15 + Math.round((i / blobFiles.length) * 75))
  }

  onProgress?.(90)

  // Single Dexie transaction — all or nothing
  await db.transaction(
    'rw',
    [db.projects, db.scenes, db.hotspots, db.sourcePhotos, db.blobs],
    async () => {
      await db.blobs.bulkAdd(blobEntries)
      await db.projects.add(newProject)
      if (newScenes.length) await db.scenes.bulkAdd(newScenes)
      if (newHotspots.length) await db.hotspots.bulkAdd(newHotspots)
      if (newSourcePhotos.length) await db.sourcePhotos.bulkAdd(newSourcePhotos)
    }
  )

  onProgress?.(100)

  return {
    projectId,
    stats: manifest.stats,
  }
}
