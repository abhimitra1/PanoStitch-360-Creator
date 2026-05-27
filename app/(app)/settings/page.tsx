'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, HardDrive, Trash2, AlertTriangle, Download, Image, Archive } from 'lucide-react'
import { db } from '@/lib/db/schema'
import type { Project } from '@/lib/db/schema'
import { deleteProject } from '@/lib/db/transactions'
import { deleteSourcePhotosForScene } from '@/lib/db/transactions'
import { cleanupOrphanBlobs } from '@/lib/db/blobs'
import { formatBytes } from '@/lib/db/quota'
import { useQuota } from '@/lib/hooks/useQuota'
import { exportProject, exportFilename, triggerDownload } from '@/lib/export/project'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const PREFS_KEY = 'panostitch_prefs'
interface Prefs {
  skipGuide: boolean
  showBackupReminders: boolean
  transitionMs: number
}
const DEFAULT_PREFS: Prefs = { skipGuide: false, showBackupReminders: true, transitionMs: 300 }

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS
  } catch { return DEFAULT_PREFS }
}
function savePrefs(prefs: Prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {}
}

interface ProjectWithSize extends Project {
  sceneCount: number
  sizeBytes: number
}

export default function SettingsPage() {
  const { quota, refresh, persist } = useQuota()
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [orphanCount, setOrphanCount] = useState<number | null>(null)
  const [cleaningOrphans, setCleaningOrphans] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [exportingAll, setExportingAll] = useState(false)
  const [projectSizes, setProjectSizes] = useState<ProjectWithSize[]>([])
  const [loadingSizes, setLoadingSizes] = useState(false)
  const [cleaningSourcePhotos, setCleaningSourcePhotos] = useState<string | null>(null)

  useEffect(() => { setPrefs(loadPrefs()) }, [])

  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray())
  const blobCount = useLiveQuery(() => db.blobs.count())

  // Compute per-project sizes
  useEffect(() => {
    if (!projects) return
    setLoadingSizes(true)
    ;(async () => {
      const sizes: ProjectWithSize[] = []
      for (const project of projects) {
        const scenes = await db.scenes.where('projectId').equals(project.id).toArray()
        const blobIds = new Set<string>()
        for (const s of scenes) {
          blobIds.add(s.panoramaBlobId)
          blobIds.add(s.thumbnailBlobId)
          if (s.previewBlobId) blobIds.add(s.previewBlobId)
        }
        const sourcePhotos = scenes.length
          ? await db.sourcePhotos.where('sceneId').anyOf(scenes.map((s) => s.id)).toArray()
          : []
        for (const sp of sourcePhotos) blobIds.add(sp.blobId)
        const records = await db.blobs.bulkGet([...blobIds])
        const sizeBytes = records.reduce((s, r) => s + (r?.size ?? 0), 0)
        sizes.push({ ...project, sceneCount: scenes.length, sizeBytes })
      }
      setProjectSizes(sizes)
      setLoadingSizes(false)
    })()
  }, [projects])

  function updatePref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    savePrefs(next)
  }

  const handleClearAll = async () => {
    if (clearConfirmText !== 'delete everything') return
    setClearing(true)
    try {
      const allProjects = await db.projects.toArray()
      for (const p of allProjects) await deleteProject(p.id)
      await refresh()
      setClearDialogOpen(false)
      setClearConfirmText('')
    } finally { setClearing(false) }
  }

  const handleCleanOrphans = async () => {
    setCleaningOrphans(true)
    try {
      const count = await cleanupOrphanBlobs()
      setOrphanCount(count)
      await refresh()
    } finally { setCleaningOrphans(false) }
  }

  const handleExportAll = async () => {
    if (!projects || projects.length === 0) return
    setExportingAll(true)
    try {
      const JSZip = (await import('jszip')).default
      const outerZip = new JSZip()
      for (const project of projects) {
        const blob = await exportProject(project.id)
        outerZip.file(exportFilename(project.name), blob)
      }
      const allZip = await outerZip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } })
      triggerDownload(allZip, `panostitch-all-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.zip`)
    } finally { setExportingAll(false) }
  }

  const handleCleanSourcePhotos = async (projectId: string) => {
    setCleaningSourcePhotos(projectId)
    try {
      const scenes = await db.scenes.where('projectId').equals(projectId).toArray()
      for (const scene of scenes) {
        await deleteSourcePhotosForScene(scene.id)
      }
      await refresh()
      setProjectSizes((prev) => prev.map((p) => p.id === projectId ? { ...p, sizeBytes: 0 } : p))
    } finally { setCleaningSourcePhotos(null) }
  }

  return (
    <div className="px-6 sm:px-12 py-12 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-8 -ml-2">
        <Link href="/projects">
          <ArrowLeft className="h-4 w-4" />
          projects
        </Link>
      </Button>

      <h1 className="font-display font-bold text-4xl text-ink mb-10">settings</h1>

      {/* ── Storage section ── */}
      <section className="mb-10">
        <h2 className="font-mono text-xs tracking-widest text-ink-faint uppercase mb-6">storage</h2>

        <div className="border border-line rounded-[4px] divide-y divide-line">
          {/* Quota overview */}
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className="h-4 w-4 text-ink-dim" />
              <span className="text-sm font-medium text-ink">Browser storage</span>
            </div>
            {quota ? (
              <>
                <Progress
                  value={Math.min(100, quota.percent * 100)}
                  className={`h-1 mb-3 ${quota.status === 'critical' ? '[&>div]:bg-error' : quota.status === 'warning' ? '[&>div]:bg-accent' : ''}`}
                />
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-ink-dim">{formatBytes(quota.used)} used</span>
                  <span className="font-mono text-xs text-ink-faint">~{formatBytes(quota.total)} total</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${quota.persisted ? 'bg-success' : 'bg-ink-faint'}`} />
                  <span className="font-mono text-xs text-ink-faint">
                    {quota.persisted ? 'persistent storage granted' : 'storage not persistent — may be evicted'}
                  </span>
                  {!quota.persisted && (
                    <Button variant="link" size="sm" onClick={persist} className="text-xs p-0 h-auto">request</Button>
                  )}
                </div>
              </>
            ) : (
              <p className="font-mono text-xs text-ink-faint">loading...</p>
            )}
          </div>

          {/* Per-project table */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-ink">Projects</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAll}
                disabled={exportingAll || !projects || projects.length === 0}
              >
                {exportingAll ? (
                  <><Archive className="h-3.5 w-3.5 animate-pulse" />Exporting...</>
                ) : (
                  <><Download className="h-3.5 w-3.5" />Export all</>
                )}
              </Button>
            </div>
            {loadingSizes ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-surface rounded animate-pulse" />)}
              </div>
            ) : projectSizes.length === 0 ? (
              <p className="font-mono text-xs text-ink-faint">No projects yet.</p>
            ) : (
              <div className="divide-y divide-line">
                {projectSizes.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">{p.name}</p>
                      <p className="font-mono text-xs text-ink-faint mt-0.5">
                        {p.sceneCount} scene{p.sceneCount !== 1 ? 's' : ''} · {formatBytes(p.sizeBytes)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Remove source photos to save space (keeps stitched panoramas)"
                        onClick={() => handleCleanSourcePhotos(p.id)}
                        disabled={cleaningSourcePhotos === p.id}
                        className="text-xs text-ink-faint hover:text-ink"
                      >
                        {cleaningSourcePhotos === p.id ? (
                          <Image className="h-3 w-3 animate-pulse" />
                        ) : (
                          <Image className="h-3 w-3" />
                        )}
                        clean src
                      </Button>
                      <Button variant="ghost" size="sm" asChild className="text-xs text-ink-faint hover:text-ink">
                        <Link href={`/projects/${p.id}/share`}>
                          <Download className="h-3 w-3" />
                          export
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cleanup orphans */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">Clean up orphan data</p>
              <p className="text-xs text-ink-dim mt-1">Remove blobs not referenced by any scene or photo.</p>
              {orphanCount !== null && (
                <p className="font-mono text-xs text-success mt-1">
                  removed {orphanCount} orphan blob{orphanCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleCleanOrphans} disabled={cleaningOrphans}>
              {cleaningOrphans ? 'Cleaning...' : 'Clean up'}
            </Button>
          </div>
        </div>
      </section>

      {/* ── Preferences ── */}
      <section className="mb-10">
        <h2 className="font-mono text-xs tracking-widest text-ink-faint uppercase mb-6">preferences</h2>
        <div className="border border-line rounded-[4px] divide-y divide-line">
          <PrefToggle
            label="Skip capture guide"
            description="Go straight to photo upload when adding a scene."
            checked={prefs.skipGuide}
            onChange={(v) => updatePref('skipGuide', v)}
          />
          <PrefToggle
            label="Show backup reminders"
            description="Show a banner when a project hasn't been exported in 14 days."
            checked={prefs.showBackupReminders}
            onChange={(v) => updatePref('showBackupReminders', v)}
          />
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">Scene transition speed</p>
              <p className="text-xs text-ink-dim mt-1">{prefs.transitionMs}ms fade between scenes in tour</p>
            </div>
            <input
              type="range"
              min={100}
              max={1000}
              step={50}
              value={prefs.transitionMs}
              onChange={(e) => updatePref('transitionMs', parseInt(e.target.value))}
              className="w-32"
            />
          </div>
        </div>
      </section>

      {/* ── Danger zone ── */}
      <section>
        <h2 className="font-mono text-xs tracking-widest text-ink-faint uppercase mb-6">danger zone</h2>
        <div className="border border-error/30 rounded-[4px] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink mb-1">Delete all data</p>
              <p className="text-xs text-ink-dim leading-relaxed">
                Permanently deletes all {projects?.length ?? 0} projects, scenes, hotspots, and panoramas.
                Export projects first if you want backups.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setClearDialogOpen(true); setClearConfirmText('') }}
              disabled={!projects || projects.length === 0}
              className="border-error/40 text-error hover:bg-error/5 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete all
            </Button>
          </div>
        </div>
      </section>

      {/* Delete all dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={(o) => { if (!o) setClearDialogOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all data?</DialogTitle>
            <DialogDescription>
              This permanently deletes all {projects?.length ?? 0} projects. Cannot be undone.
              Type <span className="font-mono text-ink">delete everything</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={clearConfirmText}
            onChange={(e) => setClearConfirmText(e.target.value)}
            placeholder='type "delete everything"'
            className="mt-2"
          />
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setClearDialogOpen(false)} className="flex-1">Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearing || clearConfirmText !== 'delete everything'}
              className="flex-1 border border-error"
            >
              {clearing ? 'Deleting...' : 'Delete everything'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PrefToggle({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="p-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-dim mt-1">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full border transition-colors shrink-0 ${
          checked ? 'bg-accent border-accent' : 'bg-surface border-line'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
