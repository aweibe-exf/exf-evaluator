'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useProgram } from '@/contexts/program-context'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  BookOpen,
  Search,
  MoreHorizontal,
  Plus,
  Trash2,
  Globe,
  FolderPlus,
  FolderInput,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Template = Database['public']['Tables']['form_templates']['Row']
type TemplateSchema = { _folder?: string; pages?: unknown[] }
type SortMode = 'updated' | 'az'

function templateFolder(template: Template): string | undefined {
  const schema = template.schema as TemplateSchema
  return schema?._folder
}

export function TemplateLibraryClient() {
  const router = useRouter()
  const { currentProgram, currentRole } = useProgram()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('updated')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [emptyFolders, setEmptyFolders] = useState<string[]>([])

  // Create folder dialog
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Move to folder dialog
  const [movingTemplate, setMovingTemplate] = useState<Template | null>(null)
  const [folderInput, setFolderInput] = useState('')
  const [movingTo, setMovingTo] = useState(false)

  // Delete folder confirm
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null)
  const [deletingFolderBusy, setDeletingFolderBusy] = useState(false)

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

  async function handleMoveToFolder() {
    if (!movingTemplate) return
    const target = folderInput.trim()
    const existingSchema = (movingTemplate.schema ?? {}) as TemplateSchema
    const newSchema: TemplateSchema = { ...existingSchema }
    if (target) {
      newSchema._folder = target
    } else {
      delete newSchema._folder
    }

    setMovingTo(true)
    // NOTE: This requires the /api/templates/[id] route to support PATCH.
    // If only PUT is supported, update this to PUT with the full template payload.
    const res = await fetch(`/api/templates/${movingTemplate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema: newSchema }),
    })
    if (res.ok) {
      toast.success(target ? `Moved to "${target}"` : 'Removed from folder')
      fetchTemplates()
      setMovingTemplate(null)
      setFolderInput('')
    } else {
      toast.error('Failed to move template (API may need PATCH support)')
    }
    setMovingTo(false)
  }

  function openMoveDialog(template: Template) {
    setMovingTemplate(template)
    setFolderInput(templateFolder(template) ?? '')
  }

  function toggleFolder(name: string) {
    setCollapsedFolders(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    if (!emptyFolders.includes(name) && !templates.some(t => templateFolder(t) === name)) {
      setEmptyFolders(prev => [...prev, name])
    }
    setCreatingFolder(false)
    setNewFolderName('')
  }

  async function handleDeleteFolder(folderName: string) {
    const templatesInFolder = templates.filter(t => templateFolder(t) === folderName)
    setDeletingFolderBusy(true)
    try {
      for (const tmpl of templatesInFolder) {
        const existingSchema = (tmpl.schema ?? {}) as TemplateSchema
        const newSchema: TemplateSchema = { ...existingSchema }
        delete newSchema._folder
        await fetch(`/api/templates/${tmpl.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: newSchema }),
        })
      }
      setEmptyFolders(prev => prev.filter(f => f !== folderName))
      toast.success(`Folder "${folderName}" deleted`)
      await fetchTemplates()
    } catch {
      toast.error('Failed to delete folder')
    }
    setDeletingFolderBusy(false)
    setDeletingFolder(null)
  }

  function sortTemplates(items: Template[]): Template[] {
    if (sortMode === 'az') {
      return [...items].sort((a, b) => a.name.localeCompare(b.name))
    }
    return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // Derive folder list: union of template folders + emptyFolders, sorted A-Z
  const templateFolders = [...new Set(templates.map(t => templateFolder(t)).filter(Boolean) as string[])]
  const allFolders = [...new Set([...templateFolders, ...emptyFolders])].sort()
  const hasAnyFolders = allFolders.length > 0

  const grouped: { folder: string | null; items: Template[] }[] = [
    ...allFolders.map(folder => ({
      folder,
      items: sortTemplates(filtered.filter(t => templateFolder(t) === folder)),
    })),
    { folder: null, items: sortTemplates(filtered.filter(t => !templateFolder(t))) },
  ]

  return (
    <div className="max-w-5xl px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Templates</h1>
          <p className="mt-0.5 text-[14px] text-gray-500">Reusable form shells — creating from a template makes an independent copy</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="ghost"
              onClick={() => setCreatingFolder(true)}
              className="h-9 gap-1.5 text-[13px] text-gray-600 hover:text-gray-900"
              aria-label="Create folder"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" /> New folder
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setCreating(true)} className="bg-orange-600 hover:bg-orange-700 h-9 gap-1.5 text-[13px]">
              <Plus className="h-4 w-4" aria-hidden="true" /> New template
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <Input
            placeholder="Search templates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-[13px]"
            aria-label="Search templates"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1" role="group" aria-label="Sort order">
          <button
            onClick={() => setSortMode('updated')}
            className={cn(
              'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
              sortMode === 'updated' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
            )}
            aria-pressed={sortMode === 'updated'}
          >
            Newest
          </button>
          <button
            onClick={() => setSortMode('az')}
            className={cn(
              'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
              sortMode === 'az' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
            )}
            aria-pressed={sortMode === 'az'}
          >
            A→Z
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 && emptyFolders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-gray-200 mb-3" aria-hidden="true" />
          <p className="text-[14px] font-medium text-gray-500">
            {search ? 'No templates match your search' : 'No templates yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ folder, items }) => {
            if (items.length === 0 && folder && !emptyFolders.includes(folder)) return null
            const isCollapsed = folder ? collapsedFolders.has(folder) : false
            const FolderIcon = isCollapsed ? Folder : FolderOpen

            return (
              <div key={folder ?? '__unfiled__'}>
                {/* Folder header */}
                {(hasAnyFolders || folder) && (
                  <div className="flex items-center gap-1 mb-3 group/folder">
                    <button
                      onClick={() => folder && toggleFolder(folder)}
                      className={cn(
                        'flex items-center gap-2 flex-1 text-left',
                        folder ? 'cursor-pointer' : 'cursor-default'
                      )}
                      disabled={!folder}
                      aria-expanded={folder ? !isCollapsed : undefined}
                    >
                      {folder ? (
                        <>
                          {isCollapsed
                            ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                            : <ChevronDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                          }
                          <FolderIcon className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                          <span className="text-[12px] font-semibold text-gray-600 group-hover/folder:text-gray-900">{folder}</span>
                          <span className="text-[11px] text-gray-400">{items.length}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[12px] font-semibold text-gray-400 pl-5">Unfiled</span>
                          <span className="text-[11px] text-gray-300">{items.length}</span>
                        </>
                      )}
                    </button>
                    {isAdmin && folder && (
                      <button
                        onClick={() => setDeletingFolder(folder)}
                        className="p-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover/folder:opacity-100 focus-visible:opacity-100 transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                        aria-label={`Delete folder ${folder}`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}

                {/* Templates in this group */}
                {!isCollapsed && items.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label={folder ? `Templates in ${folder}` : 'Unfiled templates'}>
                    {items.map(template => (
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
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => openMoveDialog(template)}>
                                  <FolderInput className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Move to folder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
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
              </div>
            )
          })}
        </div>
      )}

      {/* Create template dialog */}
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

      {/* Create folder dialog */}
      <Dialog open={creatingFolder} onOpenChange={o => { setCreatingFolder(o); if (!o) setNewFolderName('') }}>
        <DialogContent className="sm:max-w-sm" aria-describedby="create-tpl-folder-desc">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <p id="create-tpl-folder-desc" className="text-[13px] text-muted-foreground mt-1">
              Create a folder to organize your templates.
            </p>
          </DialogHeader>
          <div className="py-2">
            <label htmlFor="new-tpl-folder-name" className="text-[13px] font-medium text-gray-700 block mb-1.5">
              Folder name
            </label>
            <Input
              id="new-tpl-folder-name"
              placeholder="e.g. Survey Tools"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              autoFocus
              className="h-9 text-[13px]"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateFolder() } }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreatingFolder(false); setNewFolderName('') }}>Cancel</Button>
            <Button onClick={handleCreateFolder} className="bg-orange-600 hover:bg-orange-700" disabled={!newFolderName.trim()}>
              Create folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to folder dialog */}
      <Dialog open={!!movingTemplate} onOpenChange={o => { if (!o) { setMovingTemplate(null); setFolderInput('') } }}>
        <DialogContent className="sm:max-w-sm" aria-describedby="move-tpl-folder-desc">
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
            <p id="move-tpl-folder-desc" className="text-[13px] text-muted-foreground mt-1">
              Choose an existing folder or type a new name.
            </p>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {allFolders.length > 0 && (
              <div className="space-y-1">
                {allFolders.map(f => (
                  <button
                    key={f}
                    onClick={() => setFolderInput(f)}
                    className={cn(
                      'flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
                      folderInput === f ? 'bg-orange-50 text-orange-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                    )}
                  >
                    <Folder className={cn('h-3.5 w-3.5 flex-shrink-0', folderInput === f ? 'text-orange-500' : 'text-amber-400')} aria-hidden="true" />
                    {f}
                  </button>
                ))}
                <button
                  onClick={() => setFolderInput('')}
                  className={cn(
                    'flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
                    folderInput === '' ? 'bg-gray-100 text-gray-700 font-medium' : 'hover:bg-gray-50 text-gray-400'
                  )}
                >
                  No folder (unfiled)
                </button>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="tpl-folder-name" className="text-[12px] font-medium text-gray-500">
                {allFolders.length > 0 ? 'Or create a new folder' : 'Folder name'}
              </label>
              <Input
                id="tpl-folder-name"
                placeholder="e.g. Survey Tools"
                value={folderInput}
                onChange={e => setFolderInput(e.target.value)}
                className="h-9 text-[13px]"
                autoFocus={allFolders.length === 0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setMovingTemplate(null); setFolderInput('') }} disabled={movingTo}>Cancel</Button>
            <Button onClick={handleMoveToFolder} className="bg-orange-600 hover:bg-orange-700" disabled={movingTo} aria-busy={movingTo}>
              {movingTo ? 'Moving…' : folderInput.trim() ? `Move to "${folderInput.trim()}"` : 'Remove from folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete folder confirm dialog */}
      <Dialog open={!!deletingFolder} onOpenChange={o => { if (!o) setDeletingFolder(null) }}>
        <DialogContent className="sm:max-w-sm" aria-describedby="delete-tpl-folder-desc">
          <DialogHeader>
            <DialogTitle>Delete folder &quot;{deletingFolder}&quot;?</DialogTitle>
            <p id="delete-tpl-folder-desc" className="text-[13px] text-muted-foreground mt-1">
              The {templates.filter(t => templateFolder(t) === deletingFolder).length} template(s) inside will be moved to Unfiled.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingFolder(null)} disabled={deletingFolderBusy}>Cancel</Button>
            <Button
              onClick={() => deletingFolder && handleDeleteFolder(deletingFolder)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletingFolderBusy}
              aria-busy={deletingFolderBusy}
            >
              {deletingFolderBusy ? 'Deleting…' : 'Delete folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
