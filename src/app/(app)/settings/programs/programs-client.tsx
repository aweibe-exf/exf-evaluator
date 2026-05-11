'use client'

import { useCallback, useEffect, useState } from 'react'
import { useProgram } from '@/contexts/program-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Building2, Archive, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Program = Database['public']['Tables']['programs']['Row']

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function ProgramsClient() {
  const { currentRole, refetch } = useProgram()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [brandColor, setBrandColor] = useState('#ea580c')
  const [submitting, setSubmitting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('programs').select('*').order('created_at', { ascending: false })
    setPrograms(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (currentRole !== 'super_admin') {
    return (
      <div className="px-8 py-8">
        <p className="text-[14px] text-gray-500">Super admin access required.</p>
      </div>
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setSubmitting(true)
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), slug: slug.trim(), description: description || undefined, brand_color: brandColor }),
    })
    if (res.ok) {
      const prog = await res.json()
      setPrograms(p => [prog, ...p])
      setCreating(false)
      setName(''); setSlug(''); setDescription('')
      toast.success(`Program "${prog.name}" created`)
      await refetch()
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(typeof err.error === 'string' ? err.error : 'Failed to create program')
    }
    setSubmitting(false)
  }

  async function handleArchive(prog: Program) {
    if (!confirm(`Archive "${prog.name}"? It will be hidden from all users.`)) return
    const res = await fetch(`/api/programs/${prog.id}`, { method: 'DELETE' })
    if (res.ok) {
      setPrograms(p => p.map(x => x.id === prog.id ? { ...x, archived_at: new Date().toISOString() } : x))
      toast.success(`"${prog.name}" archived`)
      await refetch()
    } else {
      toast.error('Failed to archive program')
    }
  }

  const active = programs.filter(p => !p.archived_at)
  const archived = programs.filter(p => p.archived_at)

  return (
    <div className="max-w-3xl px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Manage Programs</h1>
          <p className="mt-0.5 text-[14px] text-gray-500">{active.length} active · {archived.length} archived</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-orange-600 hover:bg-orange-700 h-9 gap-1.5 text-[13px]">
          <Plus className="h-4 w-4" aria-hidden="true" /> New program
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <>
          <ProgramList programs={active} onArchive={handleArchive} label="Active" />
          {archived.length > 0 && <ProgramList programs={archived} onArchive={() => {}} label="Archived" muted />}
        </>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md" aria-describedby="create-prog-desc">
          <DialogHeader>
            <DialogTitle>New program</DialogTitle>
            <p id="create-prog-desc" className="text-[13px] text-muted-foreground mt-1">Create a new evaluation program.</p>
          </DialogHeader>
          <form onSubmit={handleCreate} id="create-prog-form" className="space-y-4 py-2">
            <div>
              <label htmlFor="new-prog-name" className="text-[13px] font-medium text-gray-700 block mb-1.5">
                Name <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <Input
                id="new-prog-name"
                value={name}
                onChange={e => { setName(e.target.value); setSlug(slugify(e.target.value)) }}
                required autoFocus
                className="h-9 text-[13px]"
                placeholder="e.g. NTAE Extension Program"
              />
            </div>
            <div>
              <label htmlFor="new-prog-slug" className="text-[13px] font-medium text-gray-700 block mb-1.5">Slug</label>
              <Input
                id="new-prog-slug"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                required
                className="h-9 text-[13px] font-mono"
                pattern="[a-z0-9-]+"
              />
            </div>
            <div>
              <label htmlFor="new-prog-desc" className="text-[13px] font-medium text-gray-700 block mb-1.5">Description</label>
              <Input
                id="new-prog-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="h-9 text-[13px]"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-gray-700 block mb-1.5">Brand color</label>
              <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="h-8 w-14 rounded border border-gray-200 cursor-pointer" />
            </div>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" form="create-prog-form" className="bg-orange-600 hover:bg-orange-700" disabled={submitting || !name.trim()} aria-busy={submitting}>
              {submitting ? 'Creating…' : 'Create program'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProgramList({ programs, onArchive, label, muted }: {
  programs: Program[]
  onArchive: (p: Program) => void
  label: string
  muted?: boolean
}) {
  if (programs.length === 0) return null
  return (
    <div className="mb-6">
      <p className={cn('text-[11px] font-medium uppercase tracking-widest mb-2', muted ? 'text-gray-300' : 'text-gray-400')}>{label}</p>
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden" role="list">
        {programs.map((prog, i) => (
          <div
            key={prog.id}
            role="listitem"
            className={cn('flex items-center gap-4 px-5 py-3.5 group', i < programs.length - 1 && 'border-b border-gray-50', muted && 'opacity-50')}
          >
            <div
              className="h-8 w-8 rounded-md flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
              style={{ backgroundColor: prog.brand_color ?? '#ea580c' }}
              aria-hidden="true"
            >
              {prog.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-800 truncate">{prog.name}</p>
              <p className="text-[11px] text-gray-400 font-mono">{prog.slug}</p>
            </div>
            {prog.description && (
              <p className="text-[12px] text-gray-400 truncate max-w-[200px] hidden md:block">{prog.description}</p>
            )}
            {!prog.archived_at && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => window.open(`/settings/program`, '_self')}
                  aria-label={`Settings for ${prog.name}`}
                >
                  <ExternalLink className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onArchive(prog)}
                  aria-label={`Archive ${prog.name}`}
                >
                  <Archive className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                </Button>
              </div>
            )}
            {prog.archived_at && (
              <span className="text-[11px] text-gray-300 flex-shrink-0">
                <Building2 className="inline h-3 w-3 mr-1" aria-hidden="true" />
                Archived
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
