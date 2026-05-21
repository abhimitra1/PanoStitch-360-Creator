'use client'

import { useState } from 'react'
import { HelpCircle, Smartphone, FolderPlus, MapPin, Share2, X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M3.18 23.76c.3.17.64.22.99.14l13.23-7.63-2.9-2.9-11.32 10.39zm-1.7-20.3C1.18 3.8 1 4.18 1 4.69v14.62c0 .51.18.89.49 1.23l.07.06 8.19-8.19v-.19L1.55 3.4l-.07.06zm18.63 9.08l-2.41-1.39-3.18 3.18 3.18 3.18 2.43-1.4c.69-.4.69-1.04.01-1.44l-.03-.13zM4.17.24L17.4 7.87l-2.9 2.9L3.18.38C3.48.3 3.87.07 4.17.24z" />
    </svg>
  )
}

const STEPS = [
  {
    icon: Smartphone,
    label: 'Capture',
    title: 'Capture 360° on your phone',
    description:
      'Use the 360° Photo Cam app to shoot your space. It automatically stitches a full equirectangular panorama.',
    stores: [
      { label: 'App Store', href: 'https://apps.apple.com/in/app/360-photo-cam/id6470239030', Icon: AppleIcon },
      { label: 'Google Play', href: 'https://play.google.com/store/apps/details?id=com.dospace.photo360', Icon: GooglePlayIcon },
    ],
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: FolderPlus,
    label: 'Import',
    title: 'Create a project & import scene',
    description:
      'Create a new Project in PanoStitch. Inside the project, tap Import 360° image, upload your panorama, give the scene a name, then click Import scene.',
    color: 'text-accent',
    bg: 'bg-accent/10 border-accent/20',
  },
  {
    icon: MapPin,
    label: 'Hotspots',
    title: 'Add scenes & hotspots',
    description:
      'Import more scenes if needed. Inside each scene, click Add to place hotspots — give them an info label or link them to another scene to create navigation.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: Share2,
    label: 'Export',
    title: 'Export & share',
    description:
      'When your tour is ready, open Export on the project page. Download a self-contained HTML file and share the link or embed it anywhere.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
  },
]

export function TutorialDialog() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const step = STEPS[active]
  const Icon = step.icon

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setActive(0); setOpen(true) }}
        className="gap-1.5 font-mono text-xs tracking-wider"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        How to use
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-line">
            <DialogTitle className="font-display font-bold text-xl flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-accent" />
              Getting Started
            </DialogTitle>
            <p className="text-xs text-ink-faint font-mono tracking-wider mt-1">
              Build your first 360° virtual tour in 4 steps
            </p>
          </DialogHeader>

          {/* Step tabs */}
          <div className="flex border-b border-line">
            {STEPS.map((s, i) => {
              const StepIcon = s.icon
              return (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-mono tracking-widest uppercase transition-colors border-b-2 ${
                    i === active
                      ? 'border-accent text-accent'
                      : 'border-transparent text-ink-faint hover:text-ink-dim'
                  }`}
                >
                  <StepIcon className="h-4 w-4" />
                  {s.label}
                </button>
              )
            })}
          </div>

          {/* Step content */}
          <div className="px-6 py-6">
            <div className={`flex items-start gap-4 p-4 rounded-lg border ${step.bg} mb-5`}>
              <div className={`shrink-0 mt-0.5 ${step.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] tracking-widest text-ink-faint uppercase">
                    step {active + 1} of {STEPS.length}
                  </span>
                </div>
                <h3 className="font-display font-bold text-lg text-ink mb-2">{step.title}</h3>
                <p className="text-sm text-ink-dim leading-relaxed">{step.description}</p>
              </div>
            </div>

            {'stores' in step && step.stores && (
              <div className="flex gap-3 mb-5">
                {step.stores.map((store) => (
                  <a
                    key={store.href}
                    href={store.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-surface hover:border-accent/50 hover:bg-accent/5 transition-colors text-ink text-xs font-mono tracking-wide"
                  >
                    <store.Icon />
                    {store.label}
                  </a>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActive((a) => Math.max(0, a - 1))}
                disabled={active === 0}
                className="font-mono text-xs"
              >
                ← prev
              </Button>
              {active < STEPS.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setActive((a) => a + 1)}
                  className="gap-1.5 font-mono text-xs"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="font-mono text-xs"
                >
                  Let&apos;s go →
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
