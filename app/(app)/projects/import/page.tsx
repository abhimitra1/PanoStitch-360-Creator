'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, FileArchive, Loader2, Check, AlertTriangle } from 'lucide-react'
import { importProject } from '@/lib/export/import'
import type { ImportStats } from '@/lib/export/import'
import { formatBytes } from '@/lib/db/quota'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

type ImportState = 'idle' | 'preview' | 'importing' | 'done' | 'error'

interface Preview {
  file: File
  projectName: string
  stats: ImportStats
}

export default function ImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [state, setState] = useState<ImportState>('idle')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [pct, setPct] = useState(0)
  const [error, setError] = useState('')
  const [importedId, setImportedId] = useState<string | null>(null)

  const readPreview = useCallback(async (file: File) => {
    if (!file.name.endsWith('.panostitch')) {
      setError('Please select a .panostitch file.')
      setState('error')
      return
    }
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      const manifestFile = zip.file('manifest.json')
      if (!manifestFile) throw new Error('Invalid file: missing manifest.json')
      const manifest = JSON.parse(await manifestFile.async('string'))
      if (manifest.format !== 'panostitch') throw new Error('Not a valid .panostitch file')
      setPreview({ file, projectName: manifest.projectName, stats: manifest.stats })
      setState('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read file')
      setState('error')
    }
  }, [])

  const handleFile = useCallback((file: File) => {
    setError('')
    setState('idle')
    setPreview(null)
    readPreview(file)
  }, [readPreview])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function handleImport() {
    if (!preview) return
    setState('importing')
    setPct(0)
    try {
      const { projectId } = await importProject(preview.file, setPct)
      setImportedId(projectId)
      setState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setState('error')
    }
  }

  return (
    <div className="px-6 sm:px-12 py-12 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-8 -ml-2">
        <Link href="/projects">
          <ArrowLeft className="h-4 w-4" />
          projects
        </Link>
      </Button>

      <h1 className="font-display font-bold text-4xl text-ink mb-2">import project</h1>
      <p className="text-ink-dim font-light mb-10">
        Restore a project from a <span className="font-mono text-sm">.panostitch</span> backup file.
        This creates a new project — nothing existing is modified.
      </p>

      {state === 'done' && importedId ? (
        <div className="border border-success/40 bg-success/5 rounded-[4px] p-8 text-center">
          <Check className="h-8 w-8 text-success mx-auto mb-4" />
          <p className="font-display font-bold text-2xl text-ink mb-2">Import complete!</p>
          <p className="text-sm text-ink-dim mb-6">
            {preview?.projectName} — {preview?.stats.scenes} scene{(preview?.stats.scenes ?? 0) !== 1 ? 's' : ''}, {preview?.stats.hotspots} hotspot{(preview?.stats.hotspots ?? 0) !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild>
              <Link href={`/projects/${importedId}`}>Open project</Link>
            </Button>
            <Button variant="outline" onClick={() => { setState('idle'); setPreview(null) }}>
              Import another
            </Button>
          </div>
        </div>
      ) : state === 'importing' ? (
        <div className="border border-line rounded-[4px] p-8 text-center space-y-4">
          <Loader2 className="h-8 w-8 text-accent animate-spin mx-auto" />
          <p className="font-display font-bold text-xl text-ink">Importing {preview?.projectName}...</p>
          <Progress value={pct} className="max-w-xs mx-auto" />
          <p className="font-mono text-xs text-ink-faint">{pct}% · do not close this tab</p>
        </div>
      ) : state === 'preview' && preview ? (
        <div className="space-y-6">
          <div className="border border-line rounded-[4px] p-6">
            <div className="flex items-center gap-3 mb-5">
              <FileArchive className="h-5 w-5 text-ink-dim shrink-0" />
              <div>
                <p className="font-medium text-ink">{preview.projectName}</p>
                <p className="font-mono text-xs text-ink-faint mt-0.5">{preview.file.name}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 border-t border-line pt-5">
              <Stat label="scenes" value={preview.stats.scenes} />
              <Stat label="hotspots" value={preview.stats.hotspots} />
              <Stat label="size" value={formatBytes(preview.stats.totalBytes)} />
            </div>
          </div>
          <p className="text-xs text-ink-faint font-mono">
            This will create a new project. Nothing existing will be modified.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setState('idle'); setPreview(null) }} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleImport} className="flex-1">
              Import project
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-[4px] p-12 flex flex-col items-center text-center cursor-pointer transition-colors ${
              dragging ? 'border-accent bg-accent/5' : 'border-line hover:border-ink-faint hover:bg-surface'
            }`}
          >
            <Upload className="h-8 w-8 text-ink-dim mb-4" />
            <p className="font-display font-bold text-xl text-ink mb-2">
              Drop a .panostitch file here
            </p>
            <p className="text-sm text-ink-faint mb-4">or click to browse</p>
            <span className="font-mono text-xs text-ink-faint border border-line px-3 py-1 rounded-[2px]">
              .panostitch files only
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".panostitch"
            onChange={onInputChange}
            className="hidden"
          />

          {state === 'error' && (
            <div className="mt-4 flex items-start gap-3 border border-error/30 bg-error/5 rounded-[4px] p-4">
              <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" />
              <p className="text-sm text-error">{error}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="font-mono text-2xl text-ink">{value}</p>
      <p className="font-mono text-xs text-ink-faint mt-1">{label}</p>
    </div>
  )
}
