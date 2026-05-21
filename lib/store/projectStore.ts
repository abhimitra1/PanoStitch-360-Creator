import { create } from 'zustand'

const LAST_OPENED_KEY = 'panostitch_last_opened'
const SKIP_GUIDE_KEY = 'panostitch_skip_guide'
const FIRST_RUN_KEY = 'panostitch_first_run_done'

function getLocal(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function setLocal(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage may be unavailable in private mode
  }
}

function removeLocal(key: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {}
}

interface ProjectStoreState {
  lastOpenedProjectId: string | null
  skipCaptureGuide: boolean
  firstRunDone: boolean

  setLastOpenedProjectId: (id: string | null) => void
  setSkipCaptureGuide: (skip: boolean) => void
  markFirstRunDone: () => void
}

export const useProjectStore = create<ProjectStoreState>()((set) => ({
  lastOpenedProjectId: getLocal(LAST_OPENED_KEY),
  skipCaptureGuide: getLocal(SKIP_GUIDE_KEY) === 'true',
  firstRunDone: getLocal(FIRST_RUN_KEY) === 'true',

  setLastOpenedProjectId: (id) => {
    if (id) {
      setLocal(LAST_OPENED_KEY, id)
    } else {
      removeLocal(LAST_OPENED_KEY)
    }
    set({ lastOpenedProjectId: id })
  },

  setSkipCaptureGuide: (skip) => {
    if (skip) {
      setLocal(SKIP_GUIDE_KEY, 'true')
    } else {
      removeLocal(SKIP_GUIDE_KEY)
    }
    set({ skipCaptureGuide: skip })
  },

  markFirstRunDone: () => {
    setLocal(FIRST_RUN_KEY, 'true')
    set({ firstRunDone: true })
  },
}))
