'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Upload } from 'lucide-react'
import { db } from '@/lib/db/schema'
import { ProjectCard } from '@/components/project/ProjectCard'
import { PanoMark } from '@/components/shared/PanoMark'
import { Button } from '@/components/ui/button'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function ProjectsPage() {
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray())

  return (
    <div className="px-6 sm:px-12 py-12 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-4xl text-ink mb-1">your projects</h1>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-line mb-6">
        <span className="font-mono text-xs text-ink-faint tracking-widest">
          {projects ? `${pad(projects.length)} project${projects.length !== 1 ? 's' : ''}` : ''}
        </span>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/projects/import">
              <Upload className="h-3.5 w-3.5" />
              import
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/projects/new">
              <Plus className="h-3.5 w-3.5" />
              new project
            </Link>
          </Button>
        </div>
      </div>

      {/* Project grid or empty state */}
      {projects === undefined ? (
        <div className="flex items-center justify-center py-24">
          <PanoMark spin className="h-10 w-10 text-ink-faint" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="py-24 text-center">
      <h2 className="font-display font-bold text-3xl text-ink-dim mb-3">no projects yet.</h2>
      <p className="text-ink-faint font-light max-w-sm mx-auto mb-8 leading-relaxed">
        Create your first virtual tour from regular photos — no 360° camera needed.
      </p>
      <Button asChild>
        <Link href="/projects/new">
          <Plus className="h-4 w-4" />
          create first project
        </Link>
      </Button>
    </div>
  )
}
