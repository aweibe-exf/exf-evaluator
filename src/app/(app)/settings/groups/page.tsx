'use client'

import { useState, useEffect, useCallback } from 'react'
import { useProgram } from '@/contexts/program-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Mail,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

interface RespondentGroup {
  id: string
  name: string
  emails: string[]
  created_by_email: string | null
  created_at: string
  updated_at: string
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
}

function dedupe(emails: string[]): string[] {
  return Array.from(new Set(emails))
}

export default function RespondentGroupsPage() {
  const { currentProgram, currentRole } = useProgram()
  const isAdmin = currentRole === 'super_admin' || currentRole === 'program_admin'

  const [groups, setGroups] = useState<RespondentGroup[]>([])
  const [loading, setLoading] = useState(true)

  // Create / Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<RespondentGroup | null>(null)
  const [name, setName] = useState('')
  const [emailsRaw, setEmailsRaw] = useState('')
  const [saving, setSaving] = useState(false)
  const [parseError, setParseError] = useState('')

  const programId = currentProgram?.id

  const load = useCallback(async () => {
    if (!programId) return
    setLoading(true)
    const res = await fetch(`/api/respondent-groups?program_id=${programId}`)
    if (res.ok) setGroups(await res.json())
    setLoading(false)
  }, [programId])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingGroup(null)
    setName('')
    setEmailsRaw('')
    setParseError('')
    setDialogOpen(true)
  }

  function openEdit(g: RespondentGroup) {
    setEditingGroup(g)
    setName(g.name)
    setEmailsRaw(g.emails.join('\n'))
    setParseError('')
    setDialogOpen(true)
  }

  async function handleSave() {
    const parsed = dedupe(parseEmails(emailsRaw))
    if (!name.trim()) { setParseError('Group name is required'); return }
    if (parsed.length === 0) { setParseError('Enter at least one valid email address'); return }
    setParseError('')
    setSaving(true)

    try {
      const url = editingGroup ? `/api/respondent-groups/${editingGroup.id}` : '/api/respondent-groups'
      const method = editingGroup ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId, name: name.trim(), emails: parsed }),
      })
      if (!res.ok) {
        const json = await res.json()
        setParseError(json.error ?? 'Failed to save')
        return
      }
      toast.success(editingGroup ? 'Group updated' : 'Group created')
      setDialogOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(g: RespondentGroup) {
    if (!confirm(`Delete "${g.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/respondent-groups/${g.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Group deleted')
      setGroups(prev => prev.filter(x => x.id !== g.id))
    } else {
      toast.error('Failed to delete group')
    }
  }

  const previewCount = dedupe(parseEmails(emailsRaw)).length

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            Respondent Groups
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Create named lists of email addresses to use when inviting respondents to forms.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="mr-1.5 h-4 w-4" />
            New Group
          </Button>
        )}
      </div>

      {/* Groups list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center">
          <Users className="h-10 w-10 text-zinc-200 mb-3" />
          <p className="text-sm font-medium text-zinc-500">No respondent groups yet</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Create a group to quickly invite many respondents at once without typing each email individually.
          </p>
          {isAdmin && (
            <Button onClick={openCreate} size="sm" className="mt-4 bg-orange-600 hover:bg-orange-700 text-white">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create your first group
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.id} className="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50">
                <Users className="h-4.5 w-4.5 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900">{g.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3 w-3 text-zinc-400" />
                  <span className="text-xs text-zinc-500">
                    {g.emails.length} {g.emails.length === 1 ? 'address' : 'addresses'}
                  </span>
                  {g.created_by_email && (
                    <span className="text-xs text-zinc-400">· created by {g.created_by_email.split('@')[0]}</span>
                  )}
                </div>
                {/* Preview up to 5 emails */}
                <p className="mt-1.5 text-[11px] text-zinc-400 truncate">
                  {g.emails.slice(0, 5).join(', ')}{g.emails.length > 5 ? ` +${g.emails.length - 5} more` : ''}
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-700"
                    onClick={() => openEdit(g)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-red-500"
                    onClick={() => handleDelete(g)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'New Respondent Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600">Group name</label>
              <Input
                placeholder="e.g. 2025 Grant Recipients"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600">
                Email addresses
                <span className="ml-1 font-normal text-zinc-400">(comma, semicolon, or one per line)</span>
              </label>
              <Textarea
                placeholder="alice@example.com, bob@example.com&#10;carol@example.com"
                value={emailsRaw}
                onChange={e => { setEmailsRaw(e.target.value); setParseError('') }}
                rows={6}
                className="font-mono text-xs"
              />
              {emailsRaw.trim() && (
                <p className="text-[11px] text-zinc-500">
                  {previewCount} valid {previewCount === 1 ? 'address' : 'addresses'} detected
                </p>
              )}
            </div>
            {parseError && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {parseError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingGroup ? 'Save changes' : 'Create group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
