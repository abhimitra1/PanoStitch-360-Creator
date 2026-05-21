import { nanoid } from 'nanoid'
import { db } from './schema'
import type { Scene, Hotspot, SourcePhoto } from './schema'

export async function deleteProject(projectId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.projects, db.scenes, db.hotspots, db.sourcePhotos, db.blobs],
    async () => {
      const scenes = await db.scenes.where('projectId').equals(projectId).toArray()
      const sceneIds = scenes.map((s) => s.id)

      const blobIds: string[] = []
      for (const scene of scenes) {
        blobIds.push(scene.panoramaBlobId, scene.thumbnailBlobId)
      }

      const sourcePhotos = sceneIds.length
        ? await db.sourcePhotos.where('sceneId').anyOf(sceneIds).toArray()
        : []
      for (const photo of sourcePhotos) {
        blobIds.push(photo.blobId)
      }

      if (sceneIds.length) {
        await db.hotspots.where('sceneId').anyOf(sceneIds).delete()
        await db.sourcePhotos.where('sceneId').anyOf(sceneIds).delete()
        await db.scenes.where('projectId').equals(projectId).delete()
      }
      if (blobIds.length) {
        await db.blobs.bulkDelete(blobIds)
      }
      await db.projects.delete(projectId)
    }
  )
}

export async function deleteSceneWithCascade(sceneId: string): Promise<void> {
  await db.transaction('rw', [db.scenes, db.hotspots, db.sourcePhotos, db.blobs], async () => {
    const scene = await db.scenes.get(sceneId)
    if (!scene) return

    const blobIds = [scene.panoramaBlobId, scene.thumbnailBlobId].filter(Boolean)
    const sourcePhotos = await db.sourcePhotos.where('sceneId').equals(sceneId).toArray()
    for (const photo of sourcePhotos) {
      blobIds.push(photo.blobId)
    }

    await db.hotspots.where('sceneId').equals(sceneId).delete()
    await db.sourcePhotos.where('sceneId').equals(sceneId).delete()
    await db.blobs.bulkDelete(blobIds)
    await db.scenes.delete(sceneId)
  })
}

interface SaveSceneOptions {
  projectId: string
  name: string
  panoramaBlob: Blob
  thumbnailBlob: Blob
  sourceBlobIds: string[]
  haov: number
  vaov: number
  initialYaw: number
  initialPitch: number
  initialHfov: number
  order: number
}

export async function saveNewScene(opts: SaveSceneOptions): Promise<string> {
  const sceneId = nanoid()
  const panoramaBlobId = nanoid()
  const thumbnailBlobId = nanoid()

  await db.transaction(
    'rw',
    [db.scenes, db.blobs, db.sourcePhotos, db.projects],
    async () => {
      await db.blobs.add({
        id: panoramaBlobId,
        data: opts.panoramaBlob,
        size: opts.panoramaBlob.size,
        type: opts.panoramaBlob.type,
        createdAt: new Date(),
      })
      await db.blobs.add({
        id: thumbnailBlobId,
        data: opts.thumbnailBlob,
        size: opts.thumbnailBlob.size,
        type: opts.thumbnailBlob.type,
        createdAt: new Date(),
      })

      const scene: Scene = {
        id: sceneId,
        projectId: opts.projectId,
        name: opts.name,
        panoramaBlobId,
        thumbnailBlobId,
        haov: opts.haov,
        vaov: opts.vaov,
        initialYaw: opts.initialYaw,
        initialPitch: opts.initialPitch,
        initialHfov: opts.initialHfov,
        order: opts.order,
        createdAt: new Date(),
      }
      await db.scenes.add(scene)

      const sourcePhotoRecords: SourcePhoto[] = opts.sourceBlobIds.map((blobId, i) => ({
        id: nanoid(),
        sceneId,
        blobId,
        order: i,
      }))
      if (sourcePhotoRecords.length) {
        await db.sourcePhotos.bulkAdd(sourcePhotoRecords)
      }

      await db.projects.update(opts.projectId, { updatedAt: new Date() })
    }
  )

  return sceneId
}

// Save two reciprocal scene-link hotspots in one transaction.
// fromHotspot links A→B; toHotspot links B→A (return link).
export async function saveReciprocalHotspots(
  fromHotspot: Omit<Hotspot, 'id'>,
  toHotspot: Omit<Hotspot, 'id'>,
): Promise<[string, string]> {
  const fromId = nanoid()
  const toId = nanoid()
  await db.transaction('rw', [db.hotspots], async () => {
    await db.hotspots.bulkAdd([
      { ...fromHotspot, id: fromId },
      { ...toHotspot, id: toId },
    ])
  })
  return [fromId, toId]
}

// Delete source photos (and their blobs) for a scene while keeping the panorama.
// Used by "Clean up source photos" in Settings.
export async function deleteSourcePhotosForScene(sceneId: string): Promise<number> {
  let count = 0
  await db.transaction('rw', [db.sourcePhotos, db.blobs], async () => {
    const photos = await db.sourcePhotos.where('sceneId').equals(sceneId).toArray()
    const blobIds = photos.map((p) => p.blobId)
    await db.sourcePhotos.where('sceneId').equals(sceneId).delete()
    if (blobIds.length) await db.blobs.bulkDelete(blobIds)
    count = photos.length
  })
  return count
}

export async function cleanupStagedBlobs(blobIds: string[]): Promise<void> {
  if (blobIds.length === 0) return
  await db.blobs.bulkDelete(blobIds)
}

// ── Phase 2: blobs already stored by worker ──────────────────────────────────
// The stitcher worker pre-stores panorama + thumbnail blobs in Dexie and returns
// their IDs. This variant creates the Scene record pointing to those existing blobs
// and sets project.coverSceneId on the first scene.

interface SaveSceneFromBlobIdsOptions {
  projectId: string
  name: string
  panoramaBlobId: string
  thumbnailBlobId: string
  sourceBlobIds: string[]
  haov: number
  vaov: number
  initialYaw: number
  initialPitch: number
  initialHfov: number
}

export async function saveNewSceneFromBlobIds(opts: SaveSceneFromBlobIdsOptions): Promise<string> {
  const sceneId = nanoid()

  await db.transaction(
    'rw',
    [db.scenes, db.sourcePhotos, db.projects],
    async () => {
      // Compute order = current max + 1
      const existingScenes = await db.scenes.where('projectId').equals(opts.projectId).toArray()
      const order = existingScenes.length

      const scene: Scene = {
        id: sceneId,
        projectId: opts.projectId,
        name: opts.name,
        panoramaBlobId: opts.panoramaBlobId,
        thumbnailBlobId: opts.thumbnailBlobId,
        haov: opts.haov,
        vaov: opts.vaov,
        initialYaw: opts.initialYaw,
        initialPitch: opts.initialPitch,
        initialHfov: opts.initialHfov,
        order,
        createdAt: new Date(),
      }
      await db.scenes.add(scene)

      const sourcePhotoRecords: SourcePhoto[] = opts.sourceBlobIds.map((blobId, i) => ({
        id: nanoid(),
        sceneId,
        blobId,
        order: i,
      }))
      if (sourcePhotoRecords.length) {
        await db.sourcePhotos.bulkAdd(sourcePhotoRecords)
      }

      const projectUpdates: Partial<{ updatedAt: Date; coverSceneId: string }> = {
        updatedAt: new Date(),
      }
      // Set cover on first scene
      if (order === 0) projectUpdates.coverSceneId = sceneId
      await db.projects.update(opts.projectId, projectUpdates)
    }
  )

  return sceneId
}
