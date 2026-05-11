'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useProgram } from '@/contexts/program-context'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { BookOpen, Search, MoreHorizontal, Plus, Trash2, Globe } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Template = Database['public']['Tables']['form_templates']['Row']

export function TemplateLibraryClient() {
  const router = useRouter()
  const { currentProgram, currentRole } = useProgram()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = currentRole && ['super_admin', 'program_admin'].includes(currentRole)

  const fetchTemplates = useCallback(async () => {
    if (!currentProgram) return
    setLoading(true)
    const res = await fetch(`/api/templates?program_id=${currentProgram.id}`)
    if (res.ok) setTemplates(await res.json())
    setLoading(false)
  }, [currentProgram])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  async function handleUseTemplate(template: Template) {
    if (!currentProgram) return
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: template.name,
        description: template.description,
        program_id: currentProgram.id,
        template_id: template.id,
        schema: template.schema,
      }),
    })
    if (res.ok) {
      const form = await res.json()
      toast.success('Form created from template')
      router.push(`/forms/${form.id}/edit`)
    } else {
      toast.error('Failed to create form from template')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Archive this template?')) return
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Template archived')
      setTemplates(t => t.filter(x => x.id !== id))
    } else {
      toast.error('Failed to archive template')
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentProgram) return
    setSubmitting(true)
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        program_id: currentProgram.id,
        schema: { pages: [{ id: 'page-1', title: 'Page 1', fields: [] }] },
      }),
    })
    if (res.ok) {
      toast.success('Template created')
      setCreating(false)
      setNewName('')
      setNewDesc('')
      fetchTemplates()
    } else {
      toast.error('Failed to create template')
    }
    setSubmitting(false)
  }

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-5xl px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Templates</h1>
          <p className="mt-0.5 text-[14px] text-gray-500">Reusable form shells — creating from a template makes an independent copy</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreating(true)} className="bg-orange-600 hover:bg-orange-700 h-9 gap-1.5 text-[13px]">
            <Plus className="h-4 w-4" aria-hidden="true" /> New template
          </Button>
        )}
      </div>

      <div className="relative max-w-xs mb-5">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        <Input
          placeholder="Search templates…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-[13px]"
          aria-label="Search templates"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-gray-200 mb-3" aria-hidden="true" />
          <p className="text-[14px] font-medium text-gray-500">
            {search ? 'No templates match your search' : 'No templates yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Form templates">
          {filtered.map(template => (
            <article
              key={template.id}
              role="listitem"
              className="group relative rounded-xl border border-gray-100 bg-white p-5 hover:shadow-md transition-all flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50">
                    <BookOpen className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
                  </div>
                  {template.is_global && (
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-blue-500 bg-blue-50 rounded px-1.5 py-0.5" title="Shared across all programs">
                      <Globe className="h-2.5 w-2.5" aria-hidden="true" /> Global
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                      aria-label={`Actions for template ${template.name}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => handleDelete(template.id)} className="text-red-500 focus:text-red-500">
                        <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <h2 className="text-[14px] font-semibold text-gray-800 mb-1">{template.name}</h2>
              {template.description && (
                <p className="text-[12px] text-gray-400 flex-1 line-clamp-2">{template.description}</p>
              )}

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                <span className="text-[11px] text-gray-400">
                  {formatDistanceToNow(new Date(template.created_at), { addSuffix: true })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleUseTemplate(template)}
                  className="h-7 text-[12px] text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  aria-label={`Use template: ${template.name}`}
                >
                  Use template →
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md" aria-describedby="new-template-desc">
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
            <p id="new-template-desc" className="text-[13px] text-muted-foreground mt-1">
              Create a blank template. You can add fields after creating it.
            </p>
          </DialogHeader>
          <form onSubmit={handleCreate} id="create-template-form">
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label htmlFor="tpl-name" className="text-[13px] font-medium text-gray-700">
                  Template name <span aria-hidden="true" className="text-red-500">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <Input
                  id="tpl-name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Post-session feedback"
                  required
                  autoFocus
                  className="h-9 text-[13px]"
                  aria-required="true"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="tpl-desc" className="text-[13px] font-medium text-gray-700">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input
                  id="tpl-desc"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="What is this template for?"
                  className="h-9 text-[13px]"
                />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" form="create-template-form" className="bg-orange-600 hover:bg-orange-700" disabled={submitting || !newName.trim()} aria-busy={submitting}>
              {submitting ? 'Creating…' : 'Create template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
