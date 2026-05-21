'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MoreHorizontal, Star, Trash2, Edit3 } from 'lucide-react'
import { db } from '@/lib/db/schema'
import type { Scene } from '@/lib/db/schema'
import { deleteSceneWithCascade } from '@/lib/db/transactions'
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

function pad(n: number) {
  return String(n).padStart(2, '0')
}

interface SceneCardProps {
  scene: Scene
  index: number
  isCover: boolean
  onSetCover: (sceneId: string) => void
  onDeleted: () => void
}

export function SceneCard({ scene, index, isCover, onSetCover, onDeleted }: SceneCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const thumbnailUrl = useBlobUrl(scene.thumbnailBlobId)
  const hotspotCount = useLiveQuery(
    () => db.hotspots.where('sceneId').equals(scene.id).count(),
    [scene.id]
  )

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteSceneWithCascade(scene.id)
      setDeleteDialogOpen(false)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="group border border-line rounded-[4px] bg-surface hover:bg-surface-hover transition-colors overflow-hidden">
        {/* Thumbnail */}
        <Link href={`/projects/${scene.projectId}/scenes/${scene.id}/edit`}>
          <div className="aspect-[2/1] bg-background border-b border-line overflow-hidden relative">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-mono text-xs text-ink-faint tracking-widest">no preview</span>
              </div>
            )}
            <div className="absolute top-2 left-2">
              <span className="font-mono text-xs text-ink-faint bg-background/80 px-1.5 py-0.5 rounded">
                {pad(index + 1)}
              </span>
            </div>
          </div>
        </Link>

        {/* Info */}
        <div className="p-4">
          <Link href={`/projects/${scene.projectId}/scenes/${scene.id}/edit`} className="block">
            <h3 className="font-medium text-ink truncate">{scene.name}</h3>
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <span className="font-mono text-xs text-ink-dim tracking-wider">
              {pad(hotspotCount ?? 0)} hotspot{(hotspotCount ?? 0) !== 1 ? 's' : ''}
            </span>
            {isCover && <Star className="h-3 w-3 text-accent fill-accent" />}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 px-4 pb-3 border-t border-line pt-3">
          <Button variant="ghost" size="sm" asChild className="flex-1 justify-start">
            <Link href={`/projects/${scene.projectId}/scenes/${scene.id}/edit`}>
              <Edit3 className="h-3 w-3 mr-1" />
              edit
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSetCover(scene.id)} disabled={isCover}>
                <Star className="h-4 w-4" />
                {isCover ? 'Cover scene' : 'Set as cover'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete scene
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{scene.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This deletes the panorama, all hotspots, and source photos for this scene. Cannot be
              undone.
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
              {deleting ? 'Deleting...' : 'Delete scene'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
