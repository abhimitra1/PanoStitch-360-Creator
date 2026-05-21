'use client'

import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { useQuota } from '@/lib/hooks/useQuota'
import { formatBytes } from '@/lib/db/quota'
import { Button } from '@/components/ui/button'

export function QuotaWarning() {
  const { quota } = useQuota()
  const [dismissed, setDismissed] = useState(false)

  if (!quota || quota.status === 'ok' || dismissed) return null

  const isCritical = quota.status === 'critical'

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 border-b border-line text-sm ${
        isCritical ? 'bg-error/10 text-error' : 'bg-accent/10 text-accent'
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <p className="flex-1 font-mono text-xs tracking-wide">
        {isCritical
          ? `storage critical — ${formatBytes(quota.used)} of ~${formatBytes(quota.total)} used. free space to continue.`
          : `storage at ${Math.round(quota.percent * 100)}% — consider exporting projects to free space.`}
      </p>
      <Link href="/settings" className="underline underline-offset-2 hover:opacity-70 transition-opacity shrink-0">
        manage
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
