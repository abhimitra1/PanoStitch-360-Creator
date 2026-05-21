'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { nanoid } from 'nanoid'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db/schema'
import { requestPersistence } from '@/lib/db/quota'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Project name is required.')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Request persistence on first project save
      await requestPersistence().catch(() => {})

      const id = nanoid()
      await db.projects.add({
        id,
        name: trimmed,
        description: description.trim() || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      router.push(`/projects/${id}`)
    } catch (err) {
      console.error(err)
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        setError('Storage full. Please delete some projects or clear data before creating a new one.')
      } else {
        setError('Failed to create project. Please try again.')
      }
      setSaving(false)
    }
  }

  return (
    <div className="px-6 sm:px-12 py-12 max-w-xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-8 -ml-2">
        <Link href="/projects">
          <ArrowLeft className="h-4 w-4" />
          back
        </Link>
      </Button>

      <h1 className="font-display font-bold text-4xl text-ink mb-2">new project</h1>
      <p className="text-ink-dim font-light mb-10">
        A project holds all the scenes for one virtual tour.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="font-mono text-xs tracking-widest text-ink-faint uppercase block mb-3">
            Project name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Office Tour"
            autoFocus
            maxLength={80}
          />
        </div>

        <div>
          <label className="font-mono text-xs tracking-widest text-ink-faint uppercase block mb-3">
            Description{' '}
            <span className="text-ink-faint normal-case tracking-normal">(optional)</span>
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Virtual tour of our downtown office"
            maxLength={200}
          />
        </div>

        {error && (
          <p className="text-error text-sm font-mono tracking-wide">{error}</p>
        )}

        <Button type="submit" disabled={saving || !name.trim()} className="w-full">
          {saving ? 'Creating...' : 'Create project'}
        </Button>
      </form>
    </div>
  )
}
