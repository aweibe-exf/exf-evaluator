'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useProgram } from '@/contexts/program-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  MoreHorizontal,
  FileText,
  Pencil,
  Copy,
  Trash2,
  ExternalLink,
  Folder,
  FolderOpen,
  FolderInput,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Database } from '@/types/database'
import type { FormSettings } from '@/types/forms'

type Form = Database['public']['Tables']['forms']['Row']
type StatusFilter = 'all' | 'draft' | 'active' | 'closed'
type SortMode = 'updated' | 'az'

const statusConfig = {
  active:  { label: 'Active',  className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  draft:   { label: 'Draft',   className: 'bg-zinc-50 text-zinc-500 border-zinc-200' },
  closed:  { label: 'Closed',  className: 'bg-rose-50 text-rose-600 border-rose-100' },
}

function formSettings(form: Form): FormSettings {
  return (form.settings ?? {}) as FormSettings
}

function formatShortDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('en-US', { month: 'short', d: 'numeric' } as Intl.DateTimeFormatOptions)
}

function formatPeriod(s: FormSettings): string | null {
  const { periodType, periodValue, periodStart, periodEnd } = s
  if (!periodType || !periodValue) return null
  if (periodType === 'month') {
    const [year, month] = periodValue.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  if (periodType === 'quarter') {
    if (periodStart && periodEnd) {
      return `${periodValue} · ${formatShortDate(periodStart)} – ${formatShortDate(periodEnd)}`
    }
    return periodValue
  }
  return periodValue
}

export function FormsListClient() {
  const router = useRouter()
  const { currentProgram, currentRole } = useProgram()
  const [forms, setForms] = useState<Form[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('updated')
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [emptyFolders, setEmptyFolders] = useState<string[]>([])
  const [stats, setStats] = useState<Record<string, { completed: number; pending: number }>>({})

  // Create dialog
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Create folder dialog
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Move to folder dialog
  const [movingForm, setMovingForm] = useState<Form | null>(null)
  const [folderInput, setFolderInput] = useState('')
  const [movingTo, setMovingTo] = useState(false)

  // Delete folder confirm
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null)
  const [deletingFolderBusy, setDeletingFolderBusy] = useState(false)

  const canEdit = currentRole && ['super_admin', 'program_admin', 'staff'].includes(currentRole)

  const fetchForms = useCallback(async () => {
    if (!currentProgram) return
    setLoading(true)
    const res = await fetch(`/api/forms?program_id=${currentProgram.id}`)
    if (res.ok) setForms(await res.json())
    setLoading(false)
  }, [currentProgram])

  const fetchStats = useCallback(async () => {
    if (!currentProgram) return
    const res = await fetch(`/api/forms/stats?program_id=${currentProgram.id}`)
    if (res.ok) setStats(await res.json())
  }, [currentProgram])

  useEffect(() => {
    fetchForms()
  }, [fetchForms])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentProgram || !newName.trim()) return
    setSubmitting(true)
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined, program_id: currentProgram.id }),
    })
    if (res.ok) {
      const form = await res.json()
      toast.success('Form created')
      router.push(`/forms/${form.id}/edit`)
    } else {
      toast.error('Failed to create form')
      setSubmitting(false)
    }
  }

  async function handleDuplicate(form: Form) {
    if (!currentProgram) return
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${form.name} (copy)`, description: form.description ?? undefined, program_id: currentProgram.id, schema: form.schema }),
    })
    if (res.ok) { toast.success('Form duplicated'); fetchForms() }
    else toast.error('Failed to duplicate form')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this form? This cannot be undone.')) return
    const res = await fetch(`/api/forms/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Form deleted'); setForms(f => f.filter(x => x.id !== id)) }
    else toast.error('Failed to delete form')
  }

  async function handleStatusChange(id: string, status: 'draft' | 'active' | 'closed') {
    const res = await fetch(`/api/forms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(`Form ${status === 'active' ? 'published' : status === 'closed' ? 'closed' : 'moved to draft'}`)
      fetchForms()
    } else toast.error('Failed to update status')
  }

  async function handleMoveToFolder() {
    if (!movingForm) return
    const target = folderInput.trim()
    const existing = formSettings(movingForm)
    const merged: FormSettings = { ...existing, folder: target || undefined }
    if (!target) delete merged.folder

    setMovingTo(true)
    const res = await fetch(`/api/forms/${movingForm.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: merged }),
    })
    if (res.ok) {
      toast.success(target ? `Moved to "${target}"` : 'Removed from folder')
      fetchForms()
      setMovingForm(null)
      setFolderInput('')
    } else toast.error('Failed to move form')
    setMovingTo(false)
  }

  function openMoveDialog(form: Form) {
    setMovingForm(form)
    setFolderInput(formSettings(form).folder ?? '')
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
    if (!emptyFolders.includes(name) && !forms.some(f => formSettings(f).folder === name)) {
      setEmptyFolders(prev => [...prev, name])
    }
    setCreatingFolder(false)
    setNewFolderName('')
  }

  async function handleDeleteFolder(folderName: string) {
    const formsInFolder = forms.filter(f => formSettings(f).folder === folderName)
    setDeletingFolderBusy(true)
    try {
      for (const form of formsInFolder) {
        const existing = formSettings(form)
        const merged: FormSettings = { ...existing }
        delete merged.folder
        await fetch(`/api/forms/${form.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: merged }),
        })
      }
      setEmptyFolders(prev => prev.filter(f => f !== folderName))
      toast.success(`Folder "${folderName}" deleted, forms moved to Unfiled`)
      await fetchForms()
    } catch {
      toast.error('Failed to delete folder')
    }
    setDeletingFolderBusy(false)
    setDeletingFolder(null)
  }

  const filtered = forms.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter
    return matchesSearch && matchesStatus
  })

  function sortForms(items: Form[]): Form[] {
    if (sortMode === 'az') {
      return [...items].sort((a, b) => a.name.localeCompare(b.name))
    }
    // updated (desc)
    return [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }

  // Derive folder list: union of form folders + emptyFolders, sorted A-Z
  const formFolders = [...new Set(forms.map(f => formSettings(f).folder).filter(Boolean) as string[])]
  const allFolders = [...new Set([...formFolders, ...emptyFolders])].sort()

  const grouped: { folder: string | null; items: Form[] }[] = [
    ...allFolders.map(folder => ({
      folder,
      items: sortForms(filtered.filter(f => formSettings(f).folder === folder)),
    })),
    { folder: null, items: sortForms(filtered.filter(f => !formSettings(f).folder)) },
  ]

  const filterButtons: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'draft', label: 'Draft' },
    { key: 'closed', label: 'Closed' },
  ]

  const hasAnyFolders = allFolders.length > 0

  return (
    <div className="max-w-5xl px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Forms</h1>
          <p className="mt-0.5 text-[14px] text-gray-500">
            {forms.length} form{forms.length !== 1 ? 's' : ''} in {currentProgram?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="ghost"
              onClick={() => setCreatingFolder(true)}
              className="h-9 gap-1.5 text-[13px] text-gray-600 hover:text-gray-900"
              aria-label="Create folder"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" /> New folder
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setCreating(true)} className="bg-orange-600 hover:bg-orange-700 h-9 gap-1.5 text-[13px]">
              <Plus className="h-4 w-4" aria-hidden="true" /> New form
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <Input
            placeholder="Search forms…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-[13px]"
            aria-label="Search forms"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1" role="group" aria-label="Filter by status">
          {filterButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => setStatusFilter(btn.key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                statusFilter === btn.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
              )}
              aria-pressed={statusFilter === btn.key}
            >
              {btn.label}
            </button>
          ))}
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
            Updated
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

      {/* Forms list */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 && emptyFolders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <FileText className="mx-auto h-8 w-8 text-gray-200 mb-3" aria-hidden="true" />
          <p className="text-[14px] font-medium text-gray-500">
            {search || statusFilter !== 'all' ? 'No forms match your filters' : 'No forms yet'}
          </p>
          {canEdit && !search && statusFilter === 'all' && (
            <Button variant="ghost" size="sm" className="mt-2 text-orange-600 hover:text-orange-700" onClick={() => setCreating(true)}>
              Create your first form
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ folder, items }) => {
            if (items.length === 0 && folder && !emptyFolders.includes(folder)) return null
            const isCollapsed = folder ? collapsedFolders.has(folder) : false
            const FolderIcon = isCollapsed ? Folder : FolderOpen

            return (
              <div key={folder ?? '__unfiled__'}>
                {/* Folder header */}
                {(hasAnyFolders || folder) && (
                  <div className="flex items-center gap-1 mb-1.5 group/folder">
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
                    {canEdit && folder && (
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

                {/* Forms in this group */}
                {!isCollapsed && items.length > 0 && (
                  <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden" role="list" aria-label={folder ?? 'Unfiled forms'}>
                    {items.map((form, i) => {
                      const cfg = statusConfig[form.status]
                      const s = formSettings(form)
                      const period = formatPeriod(s)
                      const formStats = stats[form.id]
                      const hasTokens = formStats && (formStats.completed + formStats.pending > 0)

                      return (
                        <div
                          key={form.id}
                          role="listitem"
                          className={cn(
                            'flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group',
                            i < items.length - 1 && 'border-b border-gray-50'
                          )}
                        >
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50">
                            <FileText className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => router.push(`/forms/${form.id}/edit`)}
                                className="text-[14px] font-medium text-gray-800 hover:text-orange-600 transition-colors truncate text-left focus:outline-none focus-visible:underline"
                                aria-label={`Open form: ${form.name}`}
                              >
                                {form.name}
                              </button>
                              {period && (
                                <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-600 flex-shrink-0">
                                  <Calendar className="h-2.5 w-2.5" aria-hidden="true" />
                                  {period}
                                </span>
                              )}
                              {hasTokens && (
                                <span className="flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-2 py-0.5 flex-shrink-0">
                                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" aria-hidden="true" />
                                  <span className="text-[10px] font-medium text-emerald-600">{formStats.completed}</span>
                                  <Clock className="h-2.5 w-2.5 text-amber-500" aria-hidden="true" />
                                  <span className="text-[10px] font-medium text-amber-600">{formStats.pending}</span>
                                </span>
                              )}
                            </div>
                            {form.description && (
                              <p className="text-[12px] text-gray-400 truncate mt-0.5">{form.description}</p>
                            )}
                          </div>
                          <span className="text-[12px] text-gray-400 flex-shrink-0 hidden sm:block">
                            Updated {formatDistanceToNow(new Date(form.updated_at), { addSuffix: true })}
                          </span>
                          <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium flex-shrink-0', cfg.className)}>
                            {cfg.label}
                          </span>
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                                aria-label={`Actions for ${form.name}`}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => router.push(`/forms/${form.id}/edit`)}>
                                  <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(form)}>
                                  <Copy className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openMoveDialog(form)}>
                                  <FolderInput className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Move to folder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {form.status !== 'active' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(form.id, 'active')}>
                                    <ExternalLink className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Publish
                                  </DropdownMenuItem>
                                )}
                                {form.status === 'active' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(form.id, 'closed')}>Close</DropdownMenuItem>
                                )}
                                {form.status !== 'draft' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(form.id, 'draft')}>Move to draft</DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(form.id)} className="text-red-500 focus:text-red-500">
                                  <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create form dialog */}
      <Dialog open={creating} onOpenChange={o => { setCreating(o); if (!o) { setNewName(''); setNewDesc('') } }}>
        <DialogContent className="sm:max-w-md" aria-describedby="create-form-desc">
          <DialogHeader>
            <DialogTitle>New form</DialogTitle>
            <p id="create-form-desc" className="text-[13px] text-muted-foreground mt-1">
              Give your form a name to get started. You can change this later.
            </p>
          </DialogHeader>
          <form onSubmit={handleCreate} id="create-form">
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label htmlFor="form-name" className="text-[13px] font-medium text-gray-700">
                  Form name <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <Input
                  id="form-name"
                  placeholder="e.g. Post-session feedback"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  autoFocus
                  className="h-9 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="form-desc" className="text-[13px] font-medium text-gray-700">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input
                  id="form-desc"
                  placeholder="What is this form for?"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="h-9 text-[13px]"
                />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" form="create-form" className="bg-orange-600 hover:bg-orange-700" disabled={submitting || !newName.trim()} aria-busy={submitting}>
              {submitting ? 'Creating…' : 'Create & open'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create folder dialog */}
      <Dialog open={creatingFolder} onOpenChange={o => { setCreatingFolder(o); if (!o) setNewFolderName('') }}>
        <DialogContent className="sm:max-w-sm" aria-describedby="create-folder-desc">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <p id="create-folder-desc" className="text-[13px] text-muted-foreground mt-1">
              Create a folder to organize your forms.
            </p>
          </DialogHeader>
          <div className="py-2">
            <label htmlFor="new-folder-name" className="text-[13px] font-medium text-gray-700 block mb-1.5">
              Folder name
            </label>
            <Input
              id="new-folder-name"
              placeholder="e.g. Q1 2025 surveys"
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
      <Dialog open={!!movingForm} onOpenChange={o => { if (!o) { setMovingForm(null); setFolderInput('') } }}>
        <DialogContent className="sm:max-w-sm" aria-describedby="move-folder-desc">
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
            <p id="move-folder-desc" className="text-[13px] text-muted-foreground mt-1">
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
                  <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" aria-hidden="true" />
                  No folder (unfiled)
                </button>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="folder-name" className="text-[12px] font-medium text-gray-500">
                {allFolders.length > 0 ? 'Or create a new folder' : 'Folder name'}
              </label>
              <Input
                id="folder-name"
                placeholder="e.g. Q1 2025 surveys"
                value={folderInput}
                onChange={e => setFolderInput(e.target.value)}
                className="h-9 text-[13px]"
                autoFocus={allFolders.length === 0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setMovingForm(null); setFolderInput('') }} disabled={movingTo}>Cancel</Button>
            <Button onClick={handleMoveToFolder} className="bg-orange-600 hover:bg-orange-700 max-w-[260px] truncate" disabled={movingTo} aria-busy={movingTo}>
              {movingTo ? 'Moving…' : folderInput.trim() ? 'Move to folder' : 'Remove from folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete folder confirm dialog */}
      <Dialog open={!!deletingFolder} onOpenChange={o => { if (!o) setDeletingFolder(null) }}>
        <DialogContent className="sm:max-w-sm" aria-describedby="delete-folder-desc">
          <DialogHeader>
            <DialogTitle>Delete folder &quot;{deletingFolder}&quot;?</DialogTitle>
            <p id="delete-folder-desc" className="text-[13px] text-muted-foreground mt-1">
              The {forms.filter(f => formSettings(f).folder === deletingFolder).length} form(s) inside will be moved to Unfiled. This cannot be undone.
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
