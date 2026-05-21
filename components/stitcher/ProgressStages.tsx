'use client'

import { Check } from 'lucide-react'
import type { StitchProgress } from '@/lib/store/stitcherStore'
import { Progress } from '@/components/ui/progress'
import type { StitchErrorCode } from '@/workers/stitcher.worker'

const STAGE_ORDER = ['loading-cv', 'decoding', 'features', 'matching', 'blending', 'thumbnail']

const STAGE_LABELS: Record<string, string> = {
  'loading-cv': 'Loading stitching engine',
  decoding: 'Decoding images',
  features: 'Detecting features',
  matching: 'Matching overlaps',
  blending: 'Blending seams',
  thumbnail: 'Generating preview',
}

// Stage weights for overall % (must sum to 100)
const STAGE_WEIGHTS: Record<string, number> = {
  'loading-cv': 10,
  decoding: 15,
  features: 20,
  matching: 25,
  blending: 20,
  thumbnail: 10,
}

export function stageToOverallPct(stage: string, pct: number): number {
  const idx = STAGE_ORDER.indexOf(stage)
  if (idx < 0) return pct
  const before = STAGE_ORDER.slice(0, idx).reduce((s, k) => s + (STAGE_WEIGHTS[k] ?? 0), 0)
  const weight = STAGE_WEIGHTS[stage] ?? 0
  return Math.round(before + (pct / 100) * weight)
}

interface ProgressStagesProps {
  progress: StitchProgress | null
  errorCode?: StitchErrorCode | null
  errorMessage?: string | null
}

function ErrorGuidance({ code, message }: { code?: StitchErrorCode | null; message?: string | null }) {
  const guidance: Record<string, string> = {
    'insufficient-overlap': `Each shot should overlap the previous by 30–50%. Try retaking with more overlap, or remove outlier photos and retry.`,
    'no-features': `This usually means low light, blank walls, or motion blur. Try shooting in better light with the phone held steady.`,
    memory: `Try with fewer or smaller photos. Mobile devices handle 8–12 photos best.`,
    'invalid-input': `Some source images could not be read. They may be corrupt or in an unsupported format.`,
    'opencv-failed': `The stitching engine encountered an internal error. Try again or use different photos.`,
    unknown: `An unexpected error occurred during stitching.`,
  }

  const detail = code ? guidance[code] : null

  return (
    <div className="border border-error/40 bg-error/10 rounded-[4px] p-4 space-y-2">
      <p className="text-error text-sm font-medium">Stitching failed</p>
      {detail && <p className="text-error/80 text-xs leading-relaxed">{detail}</p>}
      {message && !detail && <p className="text-error/80 text-xs font-mono">{message}</p>}
    </div>
  )
}

export function ProgressStages({ progress, errorCode, errorMessage }: ProgressStagesProps) {
  const activeStage = progress?.stage ?? ''
  const activeIdx = STAGE_ORDER.indexOf(activeStage)
  const overallPct = progress ? stageToOverallPct(activeStage, progress.percent) : 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Progress value={overallPct} className="h-0.5" />
        <div className="flex items-center justify-between">
          {progress?.detail && (
            <p className="font-mono text-xs text-ink-faint tracking-wide truncate">{progress.detail}</p>
          )}
          <p className="font-mono text-xs text-ink-faint tracking-wider ml-auto">{overallPct}%</p>
        </div>
      </div>

      <div className="space-y-3">
        {STAGE_ORDER.map((stage, i) => {
          const isDone = i < activeIdx
          const isActive = i === activeIdx && !errorCode
          const isFailed = i === activeIdx && !!errorCode

          return (
            <div key={stage} className="flex items-center gap-3">
              <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                isDone ? 'border-success bg-success/20' :
                isActive ? 'border-accent' :
                isFailed ? 'border-error' :
                'border-line'
              }`}>
                {isDone ? (
                  <Check className="h-3 w-3 text-success" />
                ) : isActive ? (
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                ) : isFailed ? (
                  <div className="h-2 w-2 rounded-full bg-error" />
                ) : null}
              </div>
              <span className={`font-mono text-xs tracking-wider transition-colors ${
                isDone ? 'text-ink-faint line-through' :
                isActive ? 'text-ink' :
                isFailed ? 'text-error' :
                'text-ink-faint'
              }`}>
                {STAGE_LABELS[stage] ?? stage}
                {isActive && '...'}
              </span>
            </div>
          )
        })}
      </div>

      {(errorCode || errorMessage) && (
        <ErrorGuidance code={errorCode} message={errorMessage} />
      )}
    </div>
  )
}
