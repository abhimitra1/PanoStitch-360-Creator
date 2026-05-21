'use client'

import { useState, useEffect } from 'react'
import { HardDrive, Share2, Shield } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/lib/store/projectStore'
import { requestPersistence } from '@/lib/db/quota'

export function FirstRunDialog() {
  const { firstRunDone, markFirstRunDone } = useProjectStore()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!firstRunDone) setOpen(true)
  }, [firstRunDone])

  const handleClose = async () => {
    await requestPersistence().catch(() => {})
    markFirstRunDone()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Your data stays with you.</DialogTitle>
          <DialogDescription>
            PanoStitch saves everything in your browser. Nothing leaves your device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {[
            {
              icon: Shield,
              title: 'Private by default',
              desc: 'Photos, panoramas, and tours are stored locally — never uploaded anywhere.',
            },
            {
              icon: HardDrive,
              title: 'Export regularly',
              desc: 'Clearing your browser, switching browsers, or using private mode will erase your data. Export projects as .panostitch files to keep backups.',
            },
            {
              icon: Share2,
              title: 'Share without servers',
              desc: 'Export tours as standalone HTML — recipients open it in any browser, no app needed.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <div className="mt-0.5 shrink-0">
                <Icon className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="text-xs text-ink-dim leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={handleClose} className="w-full mt-2">
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  )
}
