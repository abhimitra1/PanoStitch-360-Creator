'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProjectStore } from '@/lib/store/projectStore'
import { Button } from '@/components/ui/button'

interface GuideItem {
  icon: string
  title: string
  body: string
}

const GUIDE_ITEMS: GuideItem[] = [
  {
    icon: '◎',
    title: 'Stand in the center',
    body: 'Position yourself in the middle of the room. Rotate in place — never walk around.',
  },
  {
    icon: '↔',
    title: '30–50% overlap',
    body: 'Each photo should overlap the previous by about a third. More overlap gives the stitcher more to work with.',
  },
  {
    icon: '☀',
    title: 'Lock your exposure',
    body: 'Tap-and-hold on iPhone to lock AE/AF. On Android, lock exposure in your camera app. Consistent brightness is critical.',
  },
  {
    icon: '—',
    title: 'Keep horizon level',
    body: 'Tilt your phone slightly down to capture the floor, or slightly up for the ceiling. Avoid rotating it sideways.',
  },
  {
    icon: '✦',
    title: '8–15 photos per room',
    body: 'Fewer than 8 may not stitch well. More than 20 increases processing time significantly.',
  },
  {
    icon: '◯',
    title: 'Avoid moving objects',
    body: 'People, pets, and fast-moving objects create ghosting artifacts. Ask them to step out or wait.',
  },
]

interface CaptureGuideProps {
  projectId: string
  nextHref: string
}

export function CaptureGuide({ projectId, nextHref }: CaptureGuideProps) {
  const { skipCaptureGuide, setSkipCaptureGuide } = useProjectStore()
  const [skipNext, setSkipNext] = useState(false)

  const handleContinue = () => {
    if (skipNext) setSkipCaptureGuide(true)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <p className="font-mono text-xs tracking-widest text-ink-faint uppercase mb-8">
        before you shoot
      </p>
      <h2 className="font-display italic text-3xl text-ink mb-10">
        How to photograph for stitching
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px border border-line rounded-[4px] overflow-hidden mb-10">
        {GUIDE_ITEMS.map(({ icon, title, body }, i) => (
          <div
            key={i}
            className="bg-surface p-5 border-b border-r border-line last:border-r-0"
          >
            <div className="flex items-start gap-4">
              <span className="font-mono text-accent text-lg leading-none mt-0.5 shrink-0">
                {icon}
              </span>
              <div>
                <p className="font-medium text-ink text-sm mb-1">{title}</p>
                <p className="text-ink-dim text-sm font-light leading-relaxed">{body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={skipNext}
            onChange={(e) => setSkipNext(e.target.checked)}
            className="accent-accent"
          />
          <span className="font-mono text-xs text-ink-faint tracking-wide">
            skip this guide next time
          </span>
        </label>

        <Button asChild onClick={handleContinue}>
          <Link href={nextHref}>Next: Upload photos</Link>
        </Button>
      </div>
    </div>
  )
}
