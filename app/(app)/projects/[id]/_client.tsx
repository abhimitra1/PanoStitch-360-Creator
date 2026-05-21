'use client'

import { useState, useRef, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Play, ExternalLink, Camera } from 'lucide-react'
import { PanoMark } from '@/components/shared/PanoMark'
import { db } from '@/lib/db/schema'
import { updateProject } from '@/lib/db/queries'
import { deleteProject } from '@/lib/db/transactions'
import { SceneCard } from '@/components/project/SceneCard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface Props {
  params: Promise<{ id: string }>
}

export function ProjectDashboardClient({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const project = useLiveQuery(() => db.projects.get(id), [id])
  const scenes = useLiveQuery(
    () =>
      db.scenes
        .where('[projectId+order]')
        .between([id, -Infinity], [id, Infinity])
        .toArray(),
    [id]
  )

  if (project === undefined || scenes === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <PanoMark spin className="h-10 w-10 text-ink-faint" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="px-6 sm:px-12 py-12">
        <p className="text-ink-dim">Project not found.</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>
        </Button>
      </div>
    )
  }

  const handleNameBlur = async () => {
    setEditingName(false)
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== project.name) {
      await updateProject(id, { name: trimmed })
    }
  }

  const handleSetCover = async (sceneId: string) => {
    await updateProject(id, { coverSceneId: sceneId })
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteProject(id)
      router.push('/projects')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="px-6 sm:px-12 py-12 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-8 -ml-2">
        <Link href="/projects">
          <ArrowLeft className="h-4 w-4" />
          projects
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <Input
              ref={nameRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') nameRef.current?.blur()
                if (e.key === 'Escape') setEditingName(false)
              }}
              className="text-4xl font-display font-bold py-0 border-b-2"
              autoFocus
            />
          ) : (
            <h1
              className="font-display font-bold text-4xl text-ink cursor-pointer hover:text-ink-dim transition-colors truncate"
              onClick={() => {
                setNameInput(project.name)
                setEditingName(true)
              }}
              title="Click to rename"
            >
              {project.name}
            </h1>
          )}
          {project.description && (
            <p className="text-ink-dim font-light mt-2">{project.description}</p>
          )}
          <p className="font-mono text-xs text-ink-faint mt-2">
            updated {project.updatedAt.toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${id}/tour`}>
              <Play className="h-3.5 w-3.5" />
              preview tour
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="text-error hover:text-error"
          >
            delete
          </Button>
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between pb-6 border-b border-line mb-6">
          <h2 className="font-mono text-xs tracking-widest text-ink-faint uppercase">
            {scenes.length === 0
              ? 'scenes'
              : `${String(scenes.length).padStart(2, '0')} scene${scenes.length !== 1 ? 's' : ''}`}
          </h2>
          <Button size="sm" asChild>
            <Link href={`/projects/${id}/scenes/import360`}>
              <Camera className="h-3.5 w-3.5" />
              Import 360° scene
            </Link>
          </Button>
        </div>

        {scenes.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-line rounded-[4px]">
            <Camera className="h-10 w-10 text-ink-faint mx-auto mb-4" />
            <p className="font-display font-bold text-2xl text-ink-dim mb-3">No scenes yet.</p>
            <p className="text-ink-faint text-sm mb-8 max-w-xs mx-auto leading-relaxed">
              Import a 360° image captured with your phone or any 360° camera to get started.
            </p>
            <Button asChild>
              <Link href={`/projects/${id}/scenes/import360`}>
                <Camera className="h-4 w-4" />
                Import 360° scene
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenes.map((scene, i) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                index={i}
                isCover={project.coverSceneId === scene.id}
                onSetCover={handleSetCover}
                onDeleted={() => {
                  if (project.coverSceneId === scene.id) {
                    updateProject(id, { coverSceneId: undefined })
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {scenes.length > 0 && (
        <div className="mt-12 pt-8 border-t border-line flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${id}/share`}>
              <ExternalLink className="h-3.5 w-3.5" />
              export project
            </Link>
          </Button>
          <p className="text-xs text-ink-faint font-mono">
            last exported:{' '}
            {project.lastExportedAt ? project.lastExportedAt.toLocaleDateString() : 'never'}
          </p>
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{project.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              Permanently deletes all {scenes.length} scene{scenes.length !== 1 ? 's' : ''},
              hotspots, and panoramas. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 border border-error"
            >
              {deleting ? 'Deleting...' : 'Delete project'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
