'use client'

import { useQuota } from '@/lib/hooks/useQuota'
import { formatBytes } from '@/lib/db/quota'
import { cn } from '@/lib/utils/cn'

export function StorageMeter() {
  const { quota } = useQuota()

  if (!quota) return null

  const usedLabel = formatBytes(quota.used)
  const totalLabel = formatBytes(quota.total)
  const pct = Math.min(100, Math.round(quota.percent * 100))

  return (
    <div className="flex items-center gap-3" title={`${pct}% of storage used`}>
      <span className="font-mono text-xs tracking-wider text-ink-faint hidden sm:block">
        {usedLabel} / ~{totalLabel}
      </span>
      <div className="w-20 h-px bg-line relative overflow-hidden rounded-full">
        <div
          className={cn(
            'absolute left-0 top-0 h-full transition-all duration-1000',
            quota.status === 'critical' && 'bg-error',
            quota.status === 'warning' && 'bg-accent',
            quota.status === 'ok' && 'bg-accent/60'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
