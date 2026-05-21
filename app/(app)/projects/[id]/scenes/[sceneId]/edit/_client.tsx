'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, MapPin, Info, ChevronRight, Check } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db/schema'
import type { Hotspot, Scene } from '@/lib/db/schema'
import { getScene, getSceneHotspots, createHotspot, updateHotspot, deleteHotspot, updateScene, getProjectScenes } from '@/lib/db/queries'
import { deleteSceneWithCascade, saveReciprocalHotspots } from '@/lib/db/transactions'
import { PanoViewer, type ViewState } from '@/components/viewer/PanoViewer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  params: Promise<{ id: string; sceneId: string }>
}

type EditorMode = 'idle' | 'placing' | 'editing'

interface HotspotDraft {
  id?: string
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

export function SceneEditClient({ params }: Props) {
  const { id, sceneId } = use(params)
  const router = useRouter()

  const scene = useLiveQuery(() => getScene(sceneId), [sceneId])
  const hotspots = useLiveQuery(() => getSceneHotspots(sceneId), [sceneId]) ?? []
  const otherScenes = useLiveQuery(
    () => getProjectScenes(id).then((scenes) => scenes.filter((s) => s.id !== sceneId)),
    [id, sceneId]
  ) ?? []

  const [editorMode, setEditorMode] = useState<EditorMode>('idle')
  const [draft, setDraft] = useState<HotspotDraft | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Scene name editing
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  // Delete scene confirm
  const [deleteSceneOpen, setDeleteSceneOpen] = useState(false)
  const [deletingScene, setDeletingScene] = useState(false)

  // Target view modal
  const [targetViewOpen, setTargetViewOpen] = useState(false)
  const capturedTargetViewRef = useRef<ViewState>({ yaw: 0, pitch: 0, hfov: 100 })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const handleCanvasClick = useCallback((pos: { yaw: number; pitch: number }) => {
    if (editorMode !== 'placing') return
    setDraft({ type: 'info', yaw: pos.yaw, pitch: pos.pitch })
    setEditorMode('editing')
  }, [editorMode])

  const handleHotspotClick = useCallback((hotspot: Hotspot) => {
    if (editorMode === 'placing') return
    setDraft({
      id: hotspot.id,
      type: hotspot.type,
      yaw: hotspot.yaw,
      pitch: hotspot.pitch,
      targetSceneId: hotspot.targetSceneId,
      targetYaw: hotspot.targetYaw,
      targetPitch: hotspot.targetPitch,
      targetHfov: hotspot.targetHfov,
      title: hotspot.title,
      description: hotspot.description,
    })
    setEditorMode('editing')
  }, [editorMode])

  async function handleSaveHotspot(addReciprocal: boolean) {
    if (!draft) return
    setSaving(true)
    try {
      if (draft.id) {
        // Update existing
        await updateHotspot(draft.id, {
          type: draft.type,
          yaw: draft.yaw,
          pitch: draft.pitch,
          targetSceneId: draft.targetSceneId,
          targetYaw: draft.targetYaw,
          targetPitch: draft.targetPitch,
          targetHfov: draft.targetHfov,
          title: draft.title,
          description: draft.description,
        })
        showToast('Hotspot updated')
      } else {
        const fromHotspot: Omit<Hotspot, 'id'> = {
          sceneId,
          type: draft.type,
          yaw: draft.yaw,
          pitch: draft.pitch,
          targetSceneId: draft.targetSceneId,
          targetYaw: draft.targetYaw,
          targetPitch: draft.targetPitch,
          targetHfov: draft.targetHfov,
          title: draft.title,
          description: draft.description,
        }

        if (addReciprocal && draft.type === 'scene-link' && draft.targetSceneId) {
          const returnYaw = ((draft.yaw + 180) % 360)
          const toHotspot: Omit<Hotspot, 'id'> = {
            sceneId: draft.targetSceneId,
            type: 'scene-link',
            yaw: returnYaw,
            pitch: draft.pitch,
            targetSceneId: sceneId,
            targetYaw: (returnYaw + 180) % 360,
            targetPitch: draft.pitch,
            targetHfov: 100,
            title: undefined,
            description: undefined,
          }
          await saveReciprocalHotspots(fromHotspot, toHotspot)
          showToast('Hotspot + return link added')
        } else {
          await createHotspot({ ...fromHotspot, id: nanoid() })
          showToast('Hotspot added')
        }
      }
      setDraft(null)
      setEditorMode('idle')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteHotspot(hotspotId: string) {
    await deleteHotspot(hotspotId)
    setDeletingId(null)
    if (draft?.id === hotspotId) {
      setDraft(null)
      setEditorMode('idle')
    }
    showToast('Hotspot deleted')
  }

  const handleNameSave = async () => {
    setEditingName(false)
    const trimmed = nameInput.trim()
    if (trimmed && scene && trimmed !== scene.name) {
      await updateScene(sceneId, { name: trimmed })
    }
  }

  const handleDeleteScene = async () => {
    setDeletingScene(true)
    try {
      await deleteSceneWithCascade(sceneId)
      router.push(`/projects/${id}`)
    } finally {
      setDeletingScene(false)
    }
  }

  if (scene === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-1 w-24 bg-line rounded-full overflow-hidden">
          <div className="h-full bg-accent animate-pulse w-1/2" />
        </div>
      </div>
    )
  }

  if (!scene) {
    return (
      <div className="px-6 py-12">
        <p className="text-ink-dim">Scene not found.</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link href={`/projects/${id}`}><ArrowLeft className="h-4 w-4" />Back</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-line bg-surface shrink-0">
        <Button variant="ghost" size="sm" asChild className="-ml-1">
          <Link href={`/projects/${id}`}>
            <ArrowLeft className="h-4 w-4" />
            back
          </Link>
        </Button>
        <div className="h-4 w-px bg-line" />
        {editingName ? (
          <Input
            ref={nameRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') nameRef.current?.blur()
              if (e.key === 'Escape') setEditingName(false)
            }}
            className="h-7 text-sm font-medium w-48"
            autoFocus
          />
        ) : (
          <button
            className="text-sm font-medium text-ink hover:text-ink-dim transition-colors"
            onClick={() => { setNameInput(scene.name); setEditingName(true) }}
            title="Click to rename"
          >
            {scene.name}
          </button>
        )}

        {/* Placement mode banner */}
        {editorMode === 'placing' && (
          <div className="flex-1 flex items-center justify-center gap-2 text-xs font-mono text-accent">
            <MapPin className="h-3.5 w-3.5" />
            Click on the panorama to place a hotspot
            <button
              className="ml-2 underline text-ink-faint hover:text-ink"
              onClick={() => setEditorMode('idle')}
            >
              cancel
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteSceneOpen(true)}
            className="text-error border-error/30 hover:bg-error/5 text-xs"
          >
            <Trash2 className="h-3 w-3" />
            Delete scene
          </Button>
        </div>
      </div>

      {/* Main: viewer + side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Viewer — 70% */}
        <div className="flex-1 relative" style={{ cursor: editorMode === 'placing' ? 'crosshair' : 'default' }}>
          <PanoViewer
            panoramaBlobId={scene.panoramaBlobId}
            haov={scene.haov}
            vaov={scene.vaov}
            initialYaw={scene.initialYaw}
            initialPitch={scene.initialPitch}
            initialHfov={scene.initialHfov}
            hotspots={hotspots}
            onHotspotClick={handleHotspotClick}
            onCanvasClick={handleCanvasClick}
            mode="edit"
            className="absolute inset-0"
          />
          {/* Toast */}
          {toast && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 border border-line px-4 py-2 rounded-[4px] font-mono text-xs text-ink flex items-center gap-2 pointer-events-none">
              <Check className="h-3 w-3 text-success" />{toast}
            </div>
          )}
        </div>

        {/* Side panel — 30%, min 280px */}
        <div className="w-72 xl:w-80 shrink-0 border-l border-line bg-surface flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="font-mono text-xs tracking-widest text-ink-faint uppercase">
              {hotspots.length === 0 ? 'hotspots' : `${String(hotspots.length).padStart(2, '0')} hotspot${hotspots.length !== 1 ? 's' : ''}`}
            </span>
            <Button
              size="sm"
              onClick={() => { setEditorMode('placing'); setDraft(null) }}
              disabled={editorMode === 'placing'}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>

          {/* Hotspot list */}
          <div className="flex-1 overflow-y-auto">
            {hotspots.length === 0 && editorMode !== 'editing' && (
              <div className="py-12 px-4 text-center">
                <MapPin className="h-6 w-6 text-ink-faint mx-auto mb-3" />
                <p className="font-display font-bold text-lg text-ink-dim">No hotspots yet.</p>
                <p className="text-xs text-ink-faint mt-2 leading-relaxed">
                  Click "Add" then click anywhere on the panorama.
                </p>
              </div>
            )}
            {hotspots.map((hs) => (
              <HotspotRow
                key={hs.id}
                hotspot={hs}
                scenes={otherScenes}
                isEditing={draft?.id === hs.id}
                isDeleting={deletingId === hs.id}
                onClick={() => handleHotspotClick(hs)}
                onDeleteStart={() => setDeletingId(hs.id)}
                onDeleteConfirm={() => handleDeleteHotspot(hs.id)}
                onDeleteCancel={() => setDeletingId(null)}
              />
            ))}
          </div>

          {/* Edit form */}
          {editorMode === 'editing' && draft && (
            <HotspotForm
              draft={draft}
              isNew={!draft.id}
              scenes={otherScenes}
              saving={saving}
              onChangeDraft={setDraft}
              onOpenTargetView={() => setTargetViewOpen(true)}
              onSave={handleSaveHotspot}
              onCancel={() => { setDraft(null); setEditorMode('idle') }}
            />
          )}
        </div>
      </div>

      {/* Target view modal */}
      {draft?.type === 'scene-link' && draft.targetSceneId && (
        <TargetViewModal
          open={targetViewOpen}
          onClose={() => setTargetViewOpen(false)}
          targetScene={otherScenes.find((s) => s.id === draft.targetSceneId) ?? null}
          onViewCapture={(v) => {
            capturedTargetViewRef.current = v
          }}
          onConfirm={() => {
            const v = capturedTargetViewRef.current
            setDraft((d) => d ? { ...d, targetYaw: v.yaw, targetPitch: v.pitch, targetHfov: v.hfov } : d)
            setTargetViewOpen(false)
          }}
        />
      )}

      {/* Delete scene dialog */}
      <Dialog open={deleteSceneOpen} onOpenChange={setDeleteSceneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{scene.name}&rdquo;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-dim">
            Permanently deletes the panorama, all {hotspots.length} hotspot{hotspots.length !== 1 ? 's' : ''}, and source photos. Cannot be undone.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteSceneOpen(false)} className="flex-1">Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteScene}
              disabled={deletingScene}
              className="flex-1 border border-error"
            >
              {deletingScene ? 'Deleting...' : 'Delete scene'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Hotspot row in the list ───────────────────────────────────────────────────

function HotspotRow({
  hotspot,
  scenes,
  isEditing,
  isDeleting,
  onClick,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  hotspot: Hotspot
  scenes: Scene[]
  isEditing: boolean
  isDeleting: boolean
  onClick: () => void
  onDeleteStart: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}) {
  const targetScene = scenes.find((s) => s.id === hotspot.targetSceneId)

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-line cursor-pointer transition-colors ${
        isEditing ? 'bg-accent/5 border-l-2 border-l-accent' : 'hover:bg-surface-hover'
      }`}
      onClick={onClick}
    >
      <div className="shrink-0 text-ink-dim">
        {hotspot.type === 'scene-link' ? (
          <ChevronRight className="h-4 w-4 text-accent" />
        ) : (
          <Info className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink truncate">
          {hotspot.type === 'scene-link'
            ? targetScene?.name ?? 'Unknown scene'
            : hotspot.title ?? 'Info hotspot'}
        </p>
        <p className="font-mono text-[10px] text-ink-faint mt-0.5">
          {hotspot.yaw.toFixed(1)}° · {hotspot.pitch.toFixed(1)}°
        </p>
      </div>
      {isDeleting ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="font-mono text-[10px] text-error underline"
            onClick={(e) => { e.stopPropagation(); onDeleteConfirm() }}
          >
            confirm
          </button>
          <button
            className="font-mono text-[10px] text-ink-faint underline ml-1"
            onClick={(e) => { e.stopPropagation(); onDeleteCancel() }}
          >
            cancel
          </button>
        </div>
      ) : (
        <button
          className="shrink-0 text-ink-faint hover:text-error transition-colors"
          onClick={(e) => { e.stopPropagation(); onDeleteStart() }}
          aria-label="Delete hotspot"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Hotspot edit form ─────────────────────────────────────────────────────────

function HotspotForm({
  draft,
  isNew,
  scenes,
  saving,
  onChangeDraft,
  onOpenTargetView,
  onSave,
  onCancel,
}: {
  draft: HotspotDraft
  isNew: boolean
  scenes: Scene[]
  saving: boolean
  onChangeDraft: (d: HotspotDraft) => void
  onOpenTargetView: () => void
  onSave: (addReciprocal: boolean) => void
  onCancel: () => void
}) {
  const [addReciprocal, setAddReciprocal] = useState(true)

  const set = (changes: Partial<HotspotDraft>) => onChangeDraft({ ...draft, ...changes })

  const isValid = draft.type === 'info'
    ? !!draft.title?.trim()
    : !!draft.targetSceneId

  return (
    <div className="border-t border-line bg-background shrink-0 flex flex-col overflow-hidden" style={{ maxHeight: '65%' }}>
      {/* Scrollable fields */}
      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tracking-widest text-ink-faint uppercase">
            {isNew ? 'New hotspot' : 'Edit hotspot'}
          </span>
          <button className="text-ink-faint hover:text-ink text-xs" onClick={onCancel}>✕</button>
        </div>

        {/* Type toggle */}
        <div className="flex gap-2">
          {(['scene-link', 'info'] as const).map((t) => (
            <button
              key={t}
              onClick={() => set({ type: t })}
              className={`flex-1 py-1.5 text-xs font-mono rounded-[2px] border transition-colors ${
                draft.type === t
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-ink-dim hover:bg-surface-hover'
              }`}
            >
              {t === 'scene-link' ? 'Scene link' : 'Info'}
            </button>
          ))}
        </div>

        {draft.type === 'scene-link' ? (
          <>
            <div>
              <label className="font-mono text-[10px] tracking-widest text-ink-faint uppercase block mb-1.5">
                Target scene
              </label>
              <select
                value={draft.targetSceneId ?? ''}
                onChange={(e) => set({ targetSceneId: e.target.value || undefined })}
                className="w-full bg-surface border border-line rounded-[2px] text-xs text-ink px-2 py-1.5 font-mono"
              >
                <option value="">— select a scene —</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {draft.targetSceneId && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-dim">
                  {draft.targetYaw !== undefined
                    ? `View: ${draft.targetYaw.toFixed(1)}°, ${(draft.targetPitch ?? 0).toFixed(1)}°`
                    : 'No target view set'}
                </span>
                <Button variant="outline" size="sm" onClick={onOpenTargetView} className="text-xs h-7">
                  Set view
                </Button>
              </div>
            )}

            {isNew && draft.targetSceneId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addReciprocal}
                  onChange={(e) => setAddReciprocal(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-ink-dim">
                  Add return hotspot in {scenes.find((s) => s.id === draft.targetSceneId)?.name}
                </span>
              </label>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="font-mono text-[10px] tracking-widest text-ink-faint uppercase block mb-1.5">
                Title <span className="text-error">*</span>
              </label>
              <Input
                value={draft.title ?? ''}
                onChange={(e) => set({ title: e.target.value })}
                maxLength={60}
                placeholder="e.g. Reception desk"
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="font-mono text-[10px] tracking-widest text-ink-faint uppercase block mb-1.5">
                Description
              </label>
              <textarea
                value={draft.description ?? ''}
                onChange={(e) => set({ description: e.target.value })}
                maxLength={500}
                rows={3}
                placeholder="Optional details..."
                className="w-full bg-surface border border-line rounded-[2px] text-xs text-ink px-2 py-1.5 resize-none font-sans"
              />
            </div>
          </>
        )}

        {/* Position inputs */}
        <div className="grid grid-cols-2 gap-2">
          {(['yaw', 'pitch'] as const).map((field) => (
            <div key={field}>
              <label className="font-mono text-[10px] tracking-widest text-ink-faint uppercase block mb-1">
                {field}°
              </label>
              <input
                type="number"
                step="0.1"
                value={draft[field].toFixed(1)}
                onChange={(e) => set({ [field]: parseFloat(e.target.value) || 0 })}
                className="w-full bg-surface border border-line rounded-[2px] text-xs text-ink px-2 py-1 font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons — always visible */}
      <div className="flex gap-2 px-4 py-3 border-t border-line shrink-0">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button
          size="sm"
          onClick={() => onSave(addReciprocal)}
          disabled={saving || !isValid}
          className="flex-1"
        >
          {saving ? 'Saving...' : isNew ? 'Add' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

// ── Target view modal ─────────────────────────────────────────────────────────

function TargetViewModal({
  open,
  onClose,
  targetScene,
  onViewCapture,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  targetScene: Scene | null
  onViewCapture: (v: ViewState) => void
  onConfirm: () => void
}) {
  if (!targetScene) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-line">
          <DialogTitle className="text-base">
            Set starting view in &ldquo;{targetScene.name}&rdquo;
          </DialogTitle>
          <p className="text-xs text-ink-dim mt-1">Drag to the angle the visitor should arrive at. Click &ldquo;Use this view&rdquo; to save it.</p>
        </DialogHeader>
        <div className="aspect-[16/9] bg-surface relative">
          <PanoViewer
            panoramaBlobId={targetScene.panoramaBlobId}
            haov={targetScene.haov}
            vaov={targetScene.vaov}
            initialYaw={targetScene.initialYaw}
            initialPitch={targetScene.initialPitch}
            initialHfov={targetScene.initialHfov}
            onViewChange={onViewCapture}
            className="absolute inset-0"
          />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-line">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm}>Use this view</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
