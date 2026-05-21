'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'

const REMINDER_DISMISSED_KEY = 'panostitch_backup_reminder_dismissed'
const STALE_DAYS = 14

export function BackupReminder() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const lastDismissed = localStorage.getItem(REMINDER_DISMISSED_KEY)
    if (lastDismissed) {
      const daysSince = (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60 * 24)
      if (daysSince < STALE_DAYS) setDismissed(true)
    }
  }, [])

  const staleProject = useLiveQuery(async () => {
    const projects = await db.projects.toArray()
    const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000)
    return projects.find(
      (p) =>
        p.updatedAt > cutoff &&
        (!p.lastExportedAt || p.lastExportedAt < new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000))
    )
  })

  const dismiss = () => {
    localStorage.setItem(REMINDER_DISMISSED_KEY, String(Date.now()))
    setDismissed(true)
  }

  if (dismissed || !staleProject) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-line bg-surface text-sm">
      <p className="flex-1 font-mono text-xs tracking-wide text-ink-faint">
        <span className="text-ink">{staleProject.name}</span> hasn&apos;t been exported in {STALE_DAYS}+ days — back it up to prevent loss.
      </p>
      <Link href={`/projects/${staleProject.id}/share`} className="text-xs text-accent underline underline-offset-2 hover:opacity-70 transition-opacity shrink-0">
        export
      </Link>
      <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Dismiss" className="shrink-0">
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
