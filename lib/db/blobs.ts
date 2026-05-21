import { nanoid } from 'nanoid'
import { db, type BlobRecord } from './schema'

export async function storeBlob(data: Blob, type?: string): Promise<string> {
  const id = nanoid()
  const record: BlobRecord = {
    id,
    data,
    size: data.size,
    type: type ?? data.type,
    createdAt: new Date(),
  }
  await db.blobs.add(record)
  return id
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const record = await db.blobs.get(id)
  return record?.data
}

export async function getBlobAsUrl(id: string): Promise<string | undefined> {
  const blob = await getBlob(id)
  if (!blob) return undefined
  return URL.createObjectURL(blob)
}

export function revokeUrl(url: string): void {
  URL.revokeObjectURL(url)
}

export async function deleteBlob(id: string): Promise<void> {
  await db.blobs.delete(id)
}

export async function deleteBlobsById(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db.blobs.bulkDelete(ids)
}

export async function getTotalBlobSize(): Promise<number> {
  let total = 0
  await db.blobs.each((record) => {
    total += record.size
  })
  return total
}

export async function cleanupOrphanBlobs(): Promise<number> {
  const referencedIds = new Set<string>()

  const scenes = await db.scenes.toArray()
  for (const scene of scenes) {
    referencedIds.add(scene.panoramaBlobId)
    referencedIds.add(scene.thumbnailBlobId)
  }

  const sourcePhotos = await db.sourcePhotos.toArray()
  for (const photo of sourcePhotos) {
    referencedIds.add(photo.blobId)
  }

  const orphanIds: string[] = []
  await db.blobs.each((record) => {
    if (!referencedIds.has(record.id)) {
      orphanIds.push(record.id)
    }
  })

  if (orphanIds.length > 0) {
    await db.blobs.bulkDelete(orphanIds)
  }

  return orphanIds.length
}
