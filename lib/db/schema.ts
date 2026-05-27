import Dexie, { type EntityTable } from 'dexie'

export interface Project {
  id: string
  name: string
  description?: string
  coverSceneId?: string
  createdAt: Date
  updatedAt: Date
  lastExportedAt?: Date
}

export interface Scene {
  id: string
  projectId: string
  name: string
  panoramaBlobId: string
  thumbnailBlobId: string
  previewBlobId?: string
  haov: number
  vaov: number
  initialYaw: number
  initialPitch: number
  initialHfov: number
  order: number
  createdAt: Date
}

export interface Hotspot {
  id: string
  sceneId: string
  type: 'scene-link' | 'info'
  yaw: number
  pitch: number
  targetSceneId?: string
  targetYaw?: number
  targetPitch?: number
  targetHfov?: number
  title?: string
  description?: string
}

export interface SourcePhoto {
  id: string
  sceneId: string
  blobId: string
  order: number
}

export interface BlobRecord {
  id: string
  data: Blob
  size: number
  type: string
  createdAt: Date
}

class PanoStitchDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  scenes!: EntityTable<Scene, 'id'>
  hotspots!: EntityTable<Hotspot, 'id'>
  sourcePhotos!: EntityTable<SourcePhoto, 'id'>
  blobs!: EntityTable<BlobRecord, 'id'>

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

export const db = new PanoStitchDB()
