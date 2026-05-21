'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileArchive, Download, Globe, Check, Loader2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/schema'
import { updateProject } from '@/lib/db/queries'
import { exportProject, exportFilename, triggerDownload } from '@/lib/export/project'
import { exportTourHTML, exportTourHTMLInline, tourZipFilename, tourHtmlFilename } from '@/lib/export/tour'
import { formatBytes } from '@/lib/db/quota'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface Props {
  params: Promise<{ id: string }>
}

type ExportState = 'idle' | 'running' | 'done' | 'error'

interface ExportStatus {
  state: ExportState
  pct: number
  error?: string
}

export function ShareClient({ params }: Props) {
  const { id } = use(params)

  const project = useLiveQuery(() => db.projects.get(id), [id])
  const scenes = useLiveQuery(() => db.scenes.where('projectId').equals(id).toArray(), [id]) ?? []

  // Size estimate: sum all blob sizes referenced by this project's scenes
  const [estimatedBytes, setEstimatedBytes] = useState<number | null>(null)
  useEffect(() => {
    if (!scenes.length) { setEstimatedBytes(0); return }
    ;(async () => {
      const blobIds = new Set<string>()
      for (const s of scenes) {
        blobIds.add(s.panoramaBlobId)
        blobIds.add(s.thumbnailBlobId)
      }
      const records = await db.blobs.bulkGet([...blobIds])
      const total = records.reduce((sum, r) => sum + (r?.size ?? 0), 0)
      setEstimatedBytes(total)
    })()
  }, [scenes])

  const [panoStatus, setPanoStatus] = useState<ExportStatus>({ state: 'idle', pct: 0 })
  const [tourZipStatus, setTourZipStatus] = useState<ExportStatus>({ state: 'idle', pct: 0 })
  const [tourInlineStatus, setTourInlineStatus] = useState<ExportStatus>({ state: 'idle', pct: 0 })

  const canInline = estimatedBytes !== null && estimatedBytes < 25 * 1024 * 1024

  async function runExport(
    kind: 'panostitch' | 'tourzip' | 'tourinline',
    setStatus: (s: ExportStatus) => void,
  ) {
    setStatus({ state: 'running', pct: 0 })
    try {
      const onPct = (pct: number) => setStatus({ state: 'running', pct })

      if (kind === 'panostitch') {
        const blob = await exportProject(id, onPct)
        triggerDownload(blob, exportFilename(project?.name ?? 'project'))
        await updateProject(id, { lastExportedAt: new Date() })
      } else if (kind === 'tourzip') {
        const { zipBlob } = await exportTourHTML(id, onPct)
        triggerDownload(zipBlob, tourZipFilename(project?.name ?? 'tour'))
        await updateProject(id, { lastExportedAt: new Date() })
      } else {
        const blob = await exportTourHTMLInline(id, onPct)
        triggerDownload(blob, tourHtmlFilename(project?.name ?? 'tour'))
        await updateProject(id, { lastExportedAt: new Date() })
      }

      setStatus({ state: 'done', pct: 100 })
      setTimeout(() => setStatus({ state: 'idle', pct: 0 }), 3000)
    } catch (err) {
      setStatus({ state: 'error', pct: 0, error: err instanceof Error ? err.message : 'Export failed' })
    }
  }

  if (!project) {
    return (
      <div className="px-6 py-12">
        <div className="animate-pulse h-8 w-48 bg-surface rounded" />
      </div>
    )
  }

  return (
    <div className="px-6 sm:px-12 py-12 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-8 -ml-2">
        <Link href={`/projects/${id}`}>
          <ArrowLeft className="h-4 w-4" />
          back to project
        </Link>
      </Button>

      <h1 className="font-display font-bold text-4xl text-ink mb-1">export &amp; share</h1>
      <p className="text-ink-dim font-light mb-2">
        {project.name} · {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
        {estimatedBytes !== null && ` · ~${formatBytes(estimatedBytes)}`}
      </p>
      {project.lastExportedAt && (
        <p className="font-mono text-xs text-ink-faint mb-10">
          last exported {project.lastExportedAt.toLocaleDateString()}
        </p>
      )}
      {!project.lastExportedAt && <div className="mb-10" />}

      <div className="space-y-4">
        {/* Single HTML */}
        <ExportCard
          icon={<Download className="h-5 w-5 text-ink-dim" />}
          title="Single HTML file"
          badge=".html"
          hint="Recommended for sharing"
          description={
            canInline
              ? 'Everything in one file — perfect for emailing small tours. Open directly in any browser.'
              : `Project is ~${formatBytes(estimatedBytes ?? 0)} — too large for single-file export (limit 25 MB). Use the tour bundle instead.`
          }
          status={tourInlineStatus}
          onExport={() => runExport('tourinline', setTourInlineStatus)}
          disabled={scenes.length === 0 || !canInline}
        />

        {/* Tour zip */}
        <ExportCard
          icon={<Globe className="h-5 w-5 text-ink-dim" />}
          title="Tour bundle (zip)"
          badge=".zip"
          description="Self-contained tour you can host anywhere. Unzip and open index.html, or drop onto Netlify Drop, GitHub Pages, or any static host."
          status={tourZipStatus}
          onExport={() => runExport('tourzip', setTourZipStatus)}
          disabled={scenes.length === 0}
        />

        {/* .panostitch backup */}
        <ExportCard
          icon={<FileArchive className="h-5 w-5 text-ink-dim" />}
          title="PanoStitch backup"
          badge=".panostitch"
          description="Full backup — scenes, hotspots, panoramas, source photos. Re-import in PanoStitch to continue editing. Recommended for archiving."
          status={panoStatus}
          onExport={() => runExport('panostitch', setPanoStatus)}
          disabled={scenes.length === 0}
        />
      </div>

      {scenes.length === 0 && (
        <p className="mt-8 font-mono text-xs text-ink-faint text-center">
          Add at least one scene before exporting.
        </p>
      )}
    </div>
  )
}

// ── Export card ───────────────────────────────────────────────────────────────

function ExportCard({
  icon,
  title,
  badge,
  description,
  hint,
  status,
  onExport,
  disabled,
}: {
  icon: React.ReactNode
  title: string
  badge: string
  description: string
  hint?: string
  status: ExportStatus
  onExport: () => void
  disabled: boolean
}) {
  const isRunning = status.state === 'running'
  const isDone = status.state === 'done'
  const isError = status.state === 'error'

  return (
    <div className="border border-line rounded-[4px] p-5">
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-ink">{title}</p>
            <span className="font-mono text-[10px] text-ink-faint border border-line px-1.5 py-px rounded-[2px]">{badge}</span>
            {hint && <span className="font-mono text-[10px] text-success">{hint}</span>}
          </div>
          <p className="text-xs text-ink-dim leading-relaxed">{description}</p>
          {isError && (
            <p className="text-xs text-error mt-2 font-mono">{status.error}</p>
          )}
          {isRunning && (
            <div className="mt-3">
              <Progress value={status.pct} className="h-1" />
              <p className="font-mono text-[10px] text-ink-faint mt-1">{status.pct}%</p>
            </div>
          )}
        </div>
        <div className="shrink-0">
          <Button
            size="sm"
            variant={isDone ? 'outline' : 'default'}
            onClick={onExport}
            disabled={disabled || isRunning}
            className={isDone ? 'border-success/40 text-success' : ''}
          >
            {isRunning ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Exporting</>
            ) : isDone ? (
              <><Check className="h-3.5 w-3.5" />Downloaded</>
            ) : (
              <>Export</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
