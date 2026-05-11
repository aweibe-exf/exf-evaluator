'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { Search, Inbox, ChevronRight, Download, UserRoundCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Submission = Database['public']['Tables']['submissions']['Row'] & {
  forms: { name: string; program_id: string } | null
  effectiveStatus?: string
}

type StatusFilter = 'all' | 'submitted' | 'reviewed' | 'flagged' | 'draft'

const statusConfig: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Submitted',  className: 'bg-blue-50 text-blue-700 border-blue-100' },
  reviewed:  { label: 'Reviewed',   className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  flagged:   { label: 'Flagged',    className: 'bg-amber-50 text-amber-700 border-amber-100' },
  draft:     { label: 'Draft',      className: 'bg-zinc-50 text-zinc-500 border-zinc-200' },
}

const filterButtons: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'reviewed',  label: 'Reviewed' },
  { key: 'flagged',   label: 'Flagged' },
]

export function SubmissionsClient() {
  const router = useRouter()
  const { currentProgram } = useProgram()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false)
  const [bulkFrom, setBulkFrom] = useState('')
  const [bulkTo, setBulkTo] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const fetchSubmissions = useCallback(async () => {
    if (!currentProgram) return
    setLoading(true)
    const params = new URLSearchParams({ program_id: currentProgram.id })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    const res = await fetch(`/api/submissions?${params}`)
    if (res.ok) setSubmissions(await res.json())
    setLoading(false)
  }, [currentProgram, statusFilter])

  useEffect(() => { fetchSubmissions() }, [fetchSubmissions])

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
      fetchSubmissions()
    } else {
      toast.error('Failed to reassign submissions')
    }
  }

  const filtered = submissions.filter(s => {
    const email = s.respondent_email?.toLowerCase() ?? ''
    const formName = s.forms?.name?.toLowerCase() ?? ''
    const q = search.toLowerCase()
    return email.includes(q) || formName.includes(q)
  })

  return (
    <div className="max-w-5xl px-8 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Submissions</h1>
          <p className="mt-0.5 text-[14px] text-gray-500">
            {submissions.length} response{submissions.length !== 1 ? 's' : ''} in {currentProgram?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentProgram && submissions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-[13px]"
              onClick={() => setBulkReassignOpen(true)}
            >
              <UserRoundCog className="h-3.5 w-3.5" aria-hidden="true" /> Reassign person
            </Button>
          )}
          {currentProgram && submissions.length > 0 && (
            <a
              href={`/api/submissions/export?program_id=${currentProgram.id}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`}
              download
            >
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-[13px]">
                <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export CSV
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <Input
            placeholder="Search by email or form…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-[13px]"
            aria-label="Search submissions"
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
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <Inbox className="mx-auto h-8 w-8 text-gray-200 mb-3" aria-hidden="true" />
          <p className="text-[14px] font-medium text-gray-500">
            {search || statusFilter !== 'all' ? 'No submissions match your filters' : 'No submissions yet'}
          </p>
          {!search && statusFilter === 'all' && (
            <p className="text-[13px] text-gray-400 mt-1">Invite respondents from a published form to get started.</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden" role="list" aria-label="Submissions">
          {filtered.map((sub, i) => {
            const cfg = statusConfig[sub.effectiveStatus ?? sub.status] ?? statusConfig.draft
            const submittedAt = sub.submitted_at
              ? formatDistanceToNow(new Date(sub.submitted_at), { addSuffix: true })
              : formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })

            return (
              <button
                key={sub.id}
                role="listitem"
                onClick={() => router.push(`/submissions/${sub.id}`)}
                className={cn(
                  'w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
                  i < filtered.length - 1 && 'border-b border-gray-50'
                )}
                aria-label={`View submission from ${sub.respondent_email ?? 'unknown'}`}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                  {(sub.respondent_email?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-gray-800 truncate">
                    {sub.respondent_email ?? 'Anonymous'}
                  </p>
                  <p className="text-[12px] text-gray-400 truncate">{sub.forms?.name ?? 'Unknown form'}</p>
                </div>
                <span className="text-[12px] text-gray-400 flex-shrink-0">{submittedAt}</span>
                <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium flex-shrink-0', cfg.className)}>
                  {cfg.label}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400 flex-shrink-0" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      )}

      {/* Bulk reassign dialog */}
      <Dialog open={bulkReassignOpen} onOpenChange={o => { setBulkReassignOpen(o); if (!o) { setBulkFrom(''); setBulkTo('') } }}>
        <DialogContent className="sm:max-w-md" aria-describedby="bulk-reassign-desc">
          <DialogHeader>
            <DialogTitle>Reassign submissions</DialogTitle>
            <p id="bulk-reassign-desc" className="text-[13px] text-muted-foreground mt-1">
              Move all submissions from one person to another — useful when someone retires or hands off their account.
            </p>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="bulk-from" className="text-[13px] font-medium text-gray-700">
                From (current owner)
              </label>
              <Input
                id="bulk-from"
                type="email"
                placeholder="retiring@email.com"
                value={bulkFrom}
                onChange={e => setBulkFrom(e.target.value)}
                className="h-9 text-[13px]"
                autoFocus
              />
              {bulkFrom.trim() && (() => {
                const count = submissions.filter(s => s.respondent_email === bulkFrom.trim()).length
                return count > 0
                  ? <p className="text-[11px] text-orange-600">{count} submission{count !== 1 ? 's' : ''} will be reassigned</p>
                  : <p className="text-[11px] text-gray-400">No submissions found for this email in current view</p>
              })()}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bulk-to" className="text-[13px] font-medium text-gray-700">
                To (new owner)
              </label>
              <Input
                id="bulk-to"
                type="email"
                placeholder="successor@email.com"
                value={bulkTo}
                onChange={e => setBulkTo(e.target.value)}
                className="h-9 text-[13px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkReassignOpen(false)} disabled={bulkBusy}>Cancel</Button>
            <Button
              onClick={handleBulkReassign}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={bulkBusy || !bulkFrom.trim() || !bulkTo.trim() || bulkFrom.trim() === bulkTo.trim()}
              aria-busy={bulkBusy}
            >
              {bulkBusy ? 'Reassigning…' : 'Reassign all'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
