'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useProgram } from '@/contexts/program-context'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Search, Inbox, ChevronRight, Download, UserRoundCog,
  List, Table2, UserSearch, Loader2, ChevronDown, Calendar,
  FileText, CheckCircle2, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import type { FormSettings, FormSchema } from '@/types/forms'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Submission = Database['public']['Tables']['submissions']['Row'] & {
  forms: { name: string; program_id: string; settings: FormSettings | null } | null
  effectiveStatus?: string
}

interface FormRow {
  id: string
  name: string
  schema: FormSchema | null
  settings: FormSettings | null
  status: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeriod(settings: FormSettings | null | undefined): string | null {
  if (!settings) return null
  const { periodType, periodValue, periodStart, periodEnd } = settings
  if (periodType === 'month' && periodValue) {
    const [year, month] = periodValue.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  if (periodType === 'quarter' && periodValue) return periodValue
  if (periodStart && periodEnd) {
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split('-')
      return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    return `${fmt(periodStart)} – ${fmt(periodEnd)}`
  }
  if (periodValue) return periodValue
  return null
}

function displayName(sub: Submission): string {
  if (!sub.respondent_email) {
    const meta = (sub.metadata ?? {}) as Record<string, unknown>
    return meta.importedRow ? 'Imported' : 'Anonymous'
  }
  return sub.respondent_email
}

function escCsv(v: unknown): string {
  const s = Array.isArray(v) ? v.join('; ') : String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s
}

type StatusFilter = 'all' | 'submitted' | 'reviewed' | 'flagged' | 'draft'
type ActiveTab = 'list' | 'table' | 'respondents'

const statusConfig: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Submitted', className: 'bg-blue-50 text-blue-700 border-blue-100' },
  reviewed:  { label: 'Reviewed',  className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  flagged:   { label: 'Flagged',   className: 'bg-amber-50 text-amber-700 border-amber-100' },
  draft:     { label: 'Draft',     className: 'bg-zinc-50 text-zinc-500 border-zinc-200' },
}

const filterButtons: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'flagged', label: 'Flagged' },
]

// ---------------------------------------------------------------------------
// Table View
// ---------------------------------------------------------------------------

function TableView({ submissions, forms, programId }: {
  submissions: Submission[]
  forms: FormRow[]
  programId: string
}) {
  const [selectedFormId, setSelectedFormId] = useState<string>('')
  const [formOpen, setFormOpen] = useState(false)

  const selectedForm = forms.find(f => f.id === selectedFormId)
  const formSubmissions = submissions.filter(s => s.form_id === selectedFormId && s.status !== 'draft')

  const fields = useMemo(() => {
    if (!selectedForm?.schema) return []
    return selectedForm.schema.pages.flatMap(p => p.fields).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) => !f.hidden && f.type !== 'section' && f.type !== 'heading'
    )
  }, [selectedForm])

  function downloadCSV() {
    if (!formSubmissions.length || !fields.length) return
    const headers = ['Email', 'Submitted', 'Status', ...fields.map((f: { label?: string; id: string }) => f.label || f.id)]
    const rows = formSubmissions.map(sub => {
      const data = (sub.data ?? {}) as Record<string, unknown>
      return [
        sub.respondent_email ?? '',
        sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '',
        sub.status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...fields.map((f: any) => data[f.id] ?? ''),
      ].map(escCsv).join(',')
    })
    const csv = [headers.map(escCsv).join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedForm?.name ?? 'submissions'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Form picker + export */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setFormOpen(v => !v)}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-zinc-300 transition-colors min-w-[220px]"
          >
            <FileText className="h-3.5 w-3.5 text-zinc-400" />
            <span className={cn('flex-1 text-left', selectedForm ? 'text-zinc-900' : 'text-zinc-400')}>
              {selectedForm ? selectedForm.name : 'Select a form…'}
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-400 transition-transform', formOpen && 'rotate-180')} />
          </button>
          {formOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden">
              {forms.filter(f => f.status !== 'draft').map(f => (
                <button
                  key={f.id}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-zinc-50 transition-colors"
                  onClick={() => { setSelectedFormId(f.id); setFormOpen(false) }}
                >
                  <span className="font-medium text-zinc-900 truncate">{f.name}</span>
                  <span className="text-xs text-zinc-400 ml-2 flex-shrink-0">
                    {submissions.filter(s => s.form_id === f.id && s.status !== 'draft').length} submissions
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedFormId && formSubmissions.length > 0 && (
          <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        )}

        {selectedFormId && formSubmissions.length > 0 && (
          <span className="text-xs text-zinc-400">
            {formSubmissions.length} submission{formSubmissions.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      {!selectedFormId ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-20 text-center">
          <Table2 className="h-8 w-8 text-zinc-200 mb-3" />
          <p className="text-sm font-medium text-zinc-500">Select a form to view its data</p>
          <p className="text-xs text-zinc-400 mt-1">All fields will appear as columns</p>
        </div>
      ) : formSubmissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center">
          <Inbox className="h-8 w-8 text-zinc-200 mb-3" />
          <p className="text-sm font-medium text-zinc-500">No submissions for this form yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium text-zinc-500 whitespace-nowrap sticky left-0 bg-zinc-50">Email</th>
                <th className="px-3 py-2.5 text-left font-medium text-zinc-500 whitespace-nowrap">Submitted</th>
                <th className="px-3 py-2.5 text-left font-medium text-zinc-500 whitespace-nowrap">Status</th>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {fields.map((f: any) => (
                  <th key={f.id} className="px-3 py-2.5 text-left font-medium text-zinc-500 whitespace-nowrap max-w-[180px]">
                    {f.label || f.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {formSubmissions.map(sub => {
                const data = (sub.data ?? {}) as Record<string, unknown>
                const cfg = statusConfig[sub.status] ?? statusConfig.draft
                return (
                  <tr key={sub.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-3 py-2 text-zinc-700 font-medium whitespace-nowrap sticky left-0 bg-white">
                      {sub.respondent_email ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                      {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', cfg.className)}>
                        {cfg.label}
                      </span>
                    </td>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {fields.map((f: any) => {
                      const val = data[f.id]
                      const display = Array.isArray(val) ? val.join(', ') : String(val ?? '')
                      return (
                        <td key={f.id} className="px-3 py-2 text-zinc-600 max-w-[200px]">
                          <span className="block truncate" title={display}>{display || '—'}</span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Respondent Lookup
// ---------------------------------------------------------------------------

function RespondentLookup({ submissions, forms }: { submissions: Submission[]; forms: FormRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)

  // Group submissions by respondent email
  const respondentMap = useMemo(() => {
    const map = new Map<string, Submission[]>()
    for (const sub of submissions) {
      const key = sub.respondent_email ?? '(anonymous)'
      const bucket = map.get(key) ?? []
      bucket.push(sub)
      map.set(key, bucket)
    }
    return map
  }, [submissions])

  const respondents = useMemo(() => {
    const all = Array.from(respondentMap.entries())
      .map(([email, subs]) => ({
        email,
        count: subs.length,
        latest: subs.reduce((a, b) => (a.submitted_at ?? '') > (b.submitted_at ?? '') ? a : b),
        subs: subs.sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? '')),
      }))
      .sort((a, b) => (b.latest.submitted_at ?? '').localeCompare(a.latest.submitted_at ?? ''))

    if (!search.trim()) return all
    const q = search.toLowerCase()
    return all.filter(r =>
      r.email.toLowerCase().includes(q) ||
      r.subs.some(s => s.forms?.name?.toLowerCase().includes(q))
    )
  }, [respondentMap, search])

  const selectedRespondent = selectedEmail ? respondents.find(r => r.email === selectedEmail) : null

  return (
    <div className="flex gap-5 min-h-0">
      {/* Left: respondent list */}
      <div className="w-72 flex-shrink-0 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <Input
            placeholder="Search by email or form…"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedEmail(null) }}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          {respondents.length === 0 ? (
            <div className="py-10 text-center">
              <UserSearch className="h-7 w-7 text-zinc-200 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">No respondents found</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-[60vh] overflow-y-auto">
              {respondents.map(r => (
                <button
                  key={r.email}
                  onClick={() => setSelectedEmail(r.email)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors',
                    selectedEmail === r.email && 'bg-orange-50 border-l-2 border-orange-500'
                  )}
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500">
                    {r.email[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-800 truncate">{r.email}</p>
                    <p className="text-[10px] text-zinc-400">{r.count} submission{r.count !== 1 ? 's' : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: respondent profile */}
      <div className="flex-1 min-w-0">
        {!selectedRespondent ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white h-64 text-center">
            <UserSearch className="h-8 w-8 text-zinc-200 mb-3" />
            <p className="text-sm font-medium text-zinc-500">Select a respondent to view their history</p>
            <p className="text-xs text-zinc-400 mt-1">See all submissions across all forms over time</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Profile header */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-600">
                  {selectedRespondent.email[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{selectedRespondent.email}</p>
                  <p className="text-xs text-zinc-500">
                    {selectedRespondent.count} submission{selectedRespondent.count !== 1 ? 's' : ''} across{' '}
                    {new Set(selectedRespondent.subs.map(s => s.form_id)).size} form{new Set(selectedRespondent.subs.map(s => s.form_id)).size !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 px-1">Submission history</p>
              {selectedRespondent.subs.map((sub, i) => {
                const cfg = statusConfig[sub.status] ?? statusConfig.draft
                const period = formatPeriod(sub.forms?.settings)
                return (
                  <button
                    key={sub.id}
                    onClick={() => router.push(`/submissions/${sub.id}`)}
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm text-left hover:border-zinc-300 hover:shadow transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex-shrink-0 mt-0.5">
                          {sub.status === 'reviewed'
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            : sub.status === 'submitted'
                            ? <Clock className="h-4 w-4 text-blue-400" />
                            : <FileText className="h-4 w-4 text-zinc-300" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-800">{sub.forms?.name ?? 'Unknown form'}</p>
                          {period && (
                            <p className="text-[11px] text-orange-600 flex items-center gap-1 mt-0.5">
                              <Calendar className="h-2.5 w-2.5" />{period}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', cfg.className)}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Draft'}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-zinc-500" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SubmissionsClient() {
  const router = useRouter()
  const { currentProgram } = useProgram()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [forms, setForms] = useState<FormRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [activeTab, setActiveTab] = useState<ActiveTab>('list')
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false)
  const [bulkFrom, setBulkFrom] = useState('')
  const [bulkTo, setBulkTo] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const fetchData = useCallback(async () => {
    if (!currentProgram) return
    setLoading(true)
    const [subsRes, formsRes] = await Promise.all([
      fetch(`/api/submissions?program_id=${currentProgram.id}`),
      fetch(`/api/forms?program_id=${currentProgram.id}`),
    ])
    if (subsRes.ok) setSubmissions(await subsRes.json())
    if (formsRes.ok) setForms(await formsRes.json())
    setLoading(false)
  }, [currentProgram])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleBulkReassign() {
    if (!currentProgram || !bulkFrom.trim() || !bulkTo.trim()) return
    setBulkBusy(true)
    const res = await fetch('/api/submissions/reassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_email: bulkFrom.trim(), to_email: bulkTo.trim(), program_id: currentProgram.id }),
    })
    setBulkBusy(false)
    if (res.ok) {
      const { updated } = await res.json()
      toast.success(`${updated} submission${updated !== 1 ? 's' : ''} reassigned to ${bulkTo.trim()}`)
      setBulkReassignOpen(false)
      setBulkFrom('')
      setBulkTo('')
      fetchData()
    } else {
      toast.error('Failed to reassign submissions')
    }
  }

  const filtered = submissions.filter(s => {
    const email = s.respondent_email?.toLowerCase() ?? ''
    const formName = s.forms?.name?.toLowerCase() ?? ''
    const q = search.toLowerCase()
    return email.includes(q) || formName.includes(q)
  }).filter(s => statusFilter === 'all' || s.status === statusFilter)

  const tabs: { key: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'list', label: 'All Submissions', icon: List },
    { key: 'table', label: 'Table View', icon: Table2 },
    { key: 'respondents', label: 'Respondent Lookup', icon: UserSearch },
  ]

  return (
    <div className="max-w-6xl px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Submissions</h1>
          <p className="mt-0.5 text-[14px] text-gray-500">
            {submissions.length} response{submissions.length !== 1 ? 's' : ''} in {currentProgram?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {submissions.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-[13px]"
              onClick={() => setBulkReassignOpen(true)}>
              <UserRoundCog className="h-3.5 w-3.5" /> Reassign person
            </Button>
          )}
          {currentProgram && submissions.length > 0 && (
            <a href={`/api/submissions/export?program_id=${currentProgram.id}`} download>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-[13px]">
                <Download className="h-3.5 w-3.5" /> Export all CSV
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 mb-5 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* ── List tab ── */}
          {activeTab === 'list' && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Search by email or form…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-9 text-[13px]"
                  />
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
                  {filterButtons.map(btn => (
                    <button
                      key={btn.key}
                      onClick={() => setStatusFilter(btn.key)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                        statusFilter === btn.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
                      )}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
                  <Inbox className="mx-auto h-8 w-8 text-gray-200 mb-3" />
                  <p className="text-[14px] font-medium text-gray-500">
                    {search || statusFilter !== 'all' ? 'No submissions match your filters' : 'No submissions yet'}
                  </p>
                  {!search && statusFilter === 'all' && (
                    <p className="text-[13px] text-gray-400 mt-1">Invite respondents from a published form to get started.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                  {filtered.map((sub, i) => {
                    const cfg = statusConfig[sub.effectiveStatus ?? sub.status] ?? statusConfig.draft
                    const submittedAt = sub.submitted_at
                      ? formatDistanceToNow(new Date(sub.submitted_at), { addSuffix: true })
                      : formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })
                    return (
                      <button
                        key={sub.id}
                        onClick={() => router.push(`/submissions/${sub.id}`)}
                        className={cn(
                          'w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group',
                          i < filtered.length - 1 && 'border-b border-gray-50'
                        )}
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                          {(displayName(sub)[0] ?? '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-gray-800 truncate">{displayName(sub)}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[12px] text-gray-400 truncate">{sub.forms?.name ?? 'Unknown form'}</p>
                            {(() => {
                              const period = formatPeriod(sub.forms?.settings)
                              return period ? (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-orange-600">
                                  <Calendar className="h-2.5 w-2.5" />{period}
                                </span>
                              ) : null
                            })()}
                          </div>
                        </div>
                        <span className="text-[12px] text-gray-400 flex-shrink-0">{submittedAt}</span>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium flex-shrink-0', cfg.className)}>
                          {cfg.label}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Table tab ── */}
          {activeTab === 'table' && (
            <TableView submissions={submissions} forms={forms} programId={currentProgram?.id ?? ''} />
          )}

          {/* ── Respondent Lookup tab ── */}
          {activeTab === 'respondents' && (
            <RespondentLookup submissions={submissions} forms={forms} />
          )}
        </>
      )}

      {/* Bulk reassign dialog */}
      <Dialog open={bulkReassignOpen} onOpenChange={o => { setBulkReassignOpen(o); if (!o) { setBulkFrom(''); setBulkTo('') } }}>
        <DialogContent className="sm:max-w-md" aria-describedby="bulk-reassign-desc">
          <DialogHeader>
            <DialogTitle>Reassign submissions</DialogTitle>
            <p id="bulk-reassign-desc" className="text-[13px] text-muted-foreground mt-1">
              Move all submissions from one person to another.
            </p>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-gray-700">From (current owner)</label>
              <Input type="email" placeholder="retiring@email.com" value={bulkFrom}
                onChange={e => setBulkFrom(e.target.value)} className="h-9 text-[13px]" autoFocus />
              {bulkFrom.trim() && (() => {
                const count = submissions.filter(s => s.respondent_email === bulkFrom.trim()).length
                return count > 0
                  ? <p className="text-[11px] text-orange-600">{count} submission{count !== 1 ? 's' : ''} will be reassigned</p>
                  : <p className="text-[11px] text-gray-400">No submissions found for this email</p>
              })()}
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-gray-700">To (new owner)</label>
              <Input type="email" placeholder="successor@email.com" value={bulkTo}
                onChange={e => setBulkTo(e.target.value)} className="h-9 text-[13px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkReassignOpen(false)} disabled={bulkBusy}>Cancel</Button>
            <Button onClick={handleBulkReassign} className="bg-orange-600 hover:bg-orange-700"
              disabled={bulkBusy || !bulkFrom.trim() || !bulkTo.trim() || bulkFrom.trim() === bulkTo.trim()}>
              {bulkBusy ? 'Reassigning…' : 'Reassign all'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
