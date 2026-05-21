'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings } from 'lucide-react'
import { StorageMeter } from '@/components/storage/StorageMeter'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { TutorialDialog } from '@/components/shared/TutorialDialog'
import { PanoMark } from '@/components/shared/PanoMark'
import { Button } from '@/components/ui/button'

export function Header() {
  const pathname = usePathname()
  const onLanding = pathname === '/'

  if (onLanding) return null

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b border-line bg-background/95 backdrop-blur-sm sticky top-0 z-40 transition-colors duration-200">
      {/* Left: panorama mark + brand */}
      <Link href="/projects" className="flex items-center gap-2.5 group">
        <PanoMark className="h-7 w-7 text-ink group-hover:text-accent transition-colors shrink-0" />
        <div className="flex flex-col leading-none gap-0.5">
          <span className="font-display font-bold text-sm text-ink group-hover:text-accent transition-colors tracking-wide">
            PanoStitch
          </span>
          <span className="font-mono text-[9px] text-ink-faint tracking-widest uppercase">
            360° Virtual Tours
          </span>
        </div>
      </Link>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <StorageMeter />
        <TutorialDialog />
        <ThemeToggle />
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/settings" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  )
}
