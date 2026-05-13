'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useProgram } from '@/contexts/program-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, FileBarChart2, MoreHorizontal, Pencil, Trash2, CheckCircle2, RotateCcw } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

type Report = Database['public']['Tables']['reports']['Row']

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-zinc-50 text-zinc-500 border-zinc-200' },
  final: { label: 'Final', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
}

export function ReportsClient() {
  const router = useRouter()
  const { currentProgram, currentRole } = useProgram()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canEdit = currentRole && ['super_admin', 'program_admin', 'staff'].includes(currentRole)

  const fetchReports = useCallback(async () => {
    if (!currentProgram) return
    setReports([])
    setLoading(true)
    const res = await fetch(`/api/reports?program_id=${currentProgram.id}`)
    if (res.ok) setReports(await res.json())
    setLoading(false)
  }, [currentProgram])

  useEffect(() => { fetchReports() }, [fetchReports])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentProgram || !newTitle.trim()) return
    setSubmitting(true)
    const today = format(new Date(), 'yyyy-MM-dd')
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_id: currentProgram.id, name: newTitle.trim(), date_from: today, date_to: today }),
    })
    if (res.ok) {
      const report = await res.json()
      router.push(`/reports/${report.id}`)
    } else {
      toast.error('Failed to create report')
      setSubmitting(false)
    }
  }

  async function handleStatusChange(id: string, newStatus: 'draft' | 'final') {
    const res = await fetch(`/api/reports/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated: Report = await res.json()
      setReports(r => r.map(x => x.id === id ? updated : x))
      toast.success(newStatus === 'final' ? 'Report marked as final' : 'Report reverted to draft')
    } else {
      toast.error('Failed to update report status')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this report? This cannot be undone.')) return
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Report deleted')
      setReports(r => r.filter(x => x.id !== id))
    } else {
      toast.error('Failed to delete report')
    }
  }

  return (
    <div className="max-w-5xl px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Reports</h1>
          <p className="mt-0.5 text-[14px] text-gray-500">
            {reports.length} report{reports.length !== 1 ? 's' : ''} in {currentProgram?.name}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)} className="bg-orange-600 hover:bg-orange-700 h-9 gap-1.5 text-[13px]">
            <Plus className="h-4 w-4" aria-hidden="true" /> New report
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <FileBarChart2 className="mx-auto h-8 w-8 text-gray-200 mb-3" aria-hidden="true" />
          <p className="text-[14px] font-medium text-gray-500">No reports yet</p>
          {canEdit && (
            <Button variant="ghost" size="sm" className="mt-2 text-orange-600 hover:text-orange-700" onClick={() => setCreating(true)}>
              Create your first report
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden" role="list">
          {reports.map((report, i) => {
            const cfg = statusConfig[report.status] ?? statusConfig.draft
            return (
              <div
                key={report.id}
                role="listitem"
                className={cn('flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group', i < reports.length - 1 && 'border-b border-gray-50')}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50">
                  <FileBarChart2 className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => router.push(`/reports/${report.id}`)}
                    className="text-[14px] font-medium text-gray-800 hover:text-orange-600 transition-colors truncate block text-left focus:outline-none focus-visible:underline"
                    aria-label={`Open report: ${report.name}`}
                  >
                    {report.name}
                  </button>
                </div>
                <span className="text-[12px] text-gray-400 flex-shrink-0">
                  {formatDistanceToNow(new Date(report.updated_at), { addSuffix: true })}
                </span>
                <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium flex-shrink-0', cfg.className)}>{cfg.label}</span>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                      aria-label={`Actions for ${report.name}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => router.push(`/reports/${report.id}`)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Edit
                      </DropdownMenuItem>
                      {report.status === 'draft' ? (
                        <DropdownMenuItem onClick={() => handleStatusChange(report.id, 'final')}>
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> Mark as final
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleStatusChange(report.id, 'draft')}>
                          <RotateCcw className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Revert to draft
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(report.id)} className="text-red-500 focus:text-red-500">
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

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md" aria-describedby="create-report-desc">
          <DialogHeader>
            <DialogTitle>New report</DialogTitle>
            <p id="create-report-desc" className="text-[13px] text-muted-foreground mt-1">Give your report a title to get started.</p>
          </DialogHeader>
          <form onSubmit={handleCreate} id="create-report">
            <div className="py-2">
              <label htmlFor="report-title" className="text-[13px] font-medium text-gray-700 block mb-1.5">
                Title <span aria-hidden="true" className="text-red-500">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <Input id="report-title" placeholder="e.g. NTAE Year-End Impact Report" value={newTitle} onChange={e => setNewTitle(e.target.value)} required autoFocus className="h-9 text-[13px]" aria-required="true" />
            </div>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" form="create-report" className="bg-orange-600 hover:bg-orange-700" disabled={submitting || !newTitle.trim()} aria-busy={submitting}>
              {submitting ? 'Creating…' : 'Create & open'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
