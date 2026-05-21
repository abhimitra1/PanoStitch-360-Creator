'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MoreHorizontal, Star, Trash2, ExternalLink } from 'lucide-react'
import { db } from '@/lib/db/schema'
import type { Project } from '@/lib/db/schema'
import { deleteProject } from '@/lib/db/transactions'
import { useBlobUrl } from '@/lib/hooks/useBlobUrl'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const sceneData = useLiveQuery(async () => {
    const sceneId = project.coverSceneId
      ? project.coverSceneId
      : (await db.scenes.where('projectId').equals(project.id).first())?.id
    if (!sceneId) return null
    const scene = await db.scenes.get(sceneId)
    const count = await db.scenes.where('projectId').equals(project.id).count()
    return { scene, count }
  }, [project.id, project.coverSceneId])

  const thumbnailUrl = useBlobUrl(sceneData?.scene?.thumbnailBlobId)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteProject(project.id)
      setDeleteDialogOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const sceneCount = sceneData?.count ?? 0

  return (
    <>
      <div className="group border border-line rounded-[4px] bg-surface hover:bg-surface-hover transition-colors overflow-hidden">
        {/* Thumbnail */}
        <Link href={`/projects/${project.id}`} className="block">
          <div className="aspect-[2/1] bg-background border-b border-line overflow-hidden">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-mono text-xs text-ink-faint tracking-widest">
                  {sceneCount === 0 ? 'no scenes yet' : 'loading...'}
                </span>
              </div>
            )}
          </div>
        </Link>

        {/* Info */}
        <div className="p-4">
          <Link href={`/projects/${project.id}`} className="block group/title">
            <h3 className="font-medium text-ink group-hover/title:text-ink truncate leading-snug">
              {project.name}
            </h3>
          </Link>

          <div className="flex items-center gap-3 mt-2">
            <span className="font-mono text-xs text-ink-dim tracking-wider">
              {pad(sceneCount)} scene{sceneCount !== 1 ? 's' : ''}
            </span>
            {project.coverSceneId && (
              <Star className="h-3 w-3 text-accent fill-accent" aria-label="Cover scene" />
            )}
          </div>

          <p className="font-mono text-xs text-ink-faint mt-1">
            {timeAgo(project.updatedAt)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 px-4 pb-3 border-t border-line pt-3">
          <Button variant="ghost" size="sm" asChild className="flex-1 justify-start">
            <Link href={`/projects/${project.id}/tour`}>
              <ExternalLink className="h-3 w-3 mr-1" />
              preview
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)}>
                Open
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{project.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This permanently deletes all scenes, hotspots, photos, and panoramas for this
              project. This cannot be undone.
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
    </>
  )
}
