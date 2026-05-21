import { db } from './schema'
import type { Project, Scene, Hotspot, SourcePhoto } from './schema'

// Projects
export function getAllProjects() {
  return db.projects.orderBy('updatedAt').reverse().toArray()
}

export function getProject(id: string) {
  return db.projects.get(id)
}

export function createProject(project: Project) {
  return db.projects.add(project)
}

export function updateProject(id: string, changes: Partial<Omit<Project, 'id'>>) {
  return db.projects.update(id, { ...changes, updatedAt: new Date() })
}

// Scenes
export function getScene(id: string) {
  return db.scenes.get(id)
}

export function getProjectScenes(projectId: string) {
  return db.scenes
    .where('[projectId+order]')
    .between([projectId, -Infinity], [projectId, Infinity])
    .toArray()
}

export function getProjectSceneCount(projectId: string) {
  return db.scenes.where('projectId').equals(projectId).count()
}

export function createScene(scene: Scene) {
  return db.scenes.add(scene)
}

export function updateScene(id: string, changes: Partial<Omit<Scene, 'id'>>) {
  return db.scenes.update(id, changes)
}

export function deleteScene(id: string) {
  return db.scenes.delete(id)
}

// Hotspots
export function getHotspot(id: string) {
  return db.hotspots.get(id)
}

export function getSceneHotspots(sceneId: string) {
  return db.hotspots.where('sceneId').equals(sceneId).toArray()
}

export function getAllProjectHotspots(projectId: string) {
  return db.scenes
    .where('projectId').equals(projectId).toArray()
    .then((scenes) => {
      const sceneIds = scenes.map((s) => s.id)
      return sceneIds.length ? db.hotspots.where('sceneId').anyOf(sceneIds).toArray() : []
    })
}

export function createHotspot(hotspot: Hotspot) {
  return db.hotspots.add(hotspot)
}

export function updateHotspot(id: string, changes: Partial<Omit<Hotspot, 'id'>>) {
  return db.hotspots.update(id, changes)
}

export function deleteHotspot(id: string) {
  return db.hotspots.delete(id)
}

// Source Photos
export function getSceneSourcePhotos(sceneId: string) {
  return db.sourcePhotos
    .where('[sceneId+order]')
    .between([sceneId, -Infinity], [sceneId, Infinity])
    .toArray()
}

export function createSourcePhoto(photo: SourcePhoto) {
  return db.sourcePhotos.add(photo)
}
