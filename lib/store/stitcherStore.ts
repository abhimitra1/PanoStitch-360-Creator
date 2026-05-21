import { create } from 'zustand'

export interface StitchProgress {
  stage: string
  stageIndex: number
  totalStages: number
  percent: number
  detail?: string
}

export interface StitchFullResult {
  panoramaBlobId: string
  thumbnailBlobId: string
  haov: number
  vaov: number
}

interface StitcherStoreState {
  projectId: string | null
  photoBlobIds: string[]
  stitchProgress: StitchProgress | null
  // Stitch result — set after worker succeeds, read by preview page
  stitchResultBlobId: string | null        // panorama blob ID
  stitchThumbnailBlobId: string | null     // thumbnail blob ID
  stitchHaov: number
  stitchVaov: number
  stitchInitialYaw: number
  stitchInitialPitch: number
  stitchInitialHfov: number
  stitchError: string | null

  setProjectId: (id: string) => void
  addPhotoBlobId: (id: string) => void
  removePhotoBlobId: (id: string) => void
  reorderPhotoBlobIds: (ids: string[]) => void
  setStitchProgress: (progress: StitchProgress | null) => void
  setStitchResult: (blobId: string | null) => void
  setStitchFull: (result: StitchFullResult) => void
  setStitchError: (error: string | null) => void
  clearSession: () => void
}

const SESSION_KEY = 'panostitch_upload_session'

function saveToSession(ids: string[]) {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(ids)) } catch {}
}

function clearFromSession() {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

export function getSessionBlobIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export const useStitcherStore = create<StitcherStoreState>()((set) => ({
  projectId: null,
  photoBlobIds: [],
  stitchProgress: null,
  stitchResultBlobId: null,
  stitchThumbnailBlobId: null,
  stitchHaov: 180,
  stitchVaov: 120,
  stitchInitialYaw: 0,
  stitchInitialPitch: 0,
  stitchInitialHfov: 100,
  stitchError: null,

  setProjectId: (id) => set({ projectId: id }),

  addPhotoBlobId: (id) =>
    set((state) => {
      const ids = [...state.photoBlobIds, id]
      saveToSession(ids)
      return { photoBlobIds: ids }
    }),

  removePhotoBlobId: (id) =>
    set((state) => {
      const ids = state.photoBlobIds.filter((i) => i !== id)
      saveToSession(ids)
      return { photoBlobIds: ids }
    }),

  reorderPhotoBlobIds: (ids) => {
    saveToSession(ids)
    set({ photoBlobIds: ids })
  },

  setStitchProgress: (progress) => set({ stitchProgress: progress }),

  setStitchResult: (blobId) => set({ stitchResultBlobId: blobId }),

  setStitchFull: (result) =>
    set({
      stitchResultBlobId: result.panoramaBlobId,
      stitchThumbnailBlobId: result.thumbnailBlobId,
      stitchHaov: result.haov,
      stitchVaov: result.vaov,
    }),

  setStitchError: (error) => set({ stitchError: error }),

  clearSession: () => {
    clearFromSession()
    set({
      photoBlobIds: [],
      stitchProgress: null,
      stitchResultBlobId: null,
      stitchThumbnailBlobId: null,
      stitchHaov: 180,
      stitchVaov: 120,
      stitchInitialYaw: 0,
      stitchInitialPitch: 0,
      stitchInitialHfov: 100,
      stitchError: null,
    })
  },
}))
