'use client'

import { useCallback, useEffect, useState } from 'react'
import { useProgram } from '@/contexts/program-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ScrollText, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import type { Database } from '@/types/database'

type AuditRow = Database['public']['Tables']['audit_log']['Row']

const ACTION_COLORS: Record<string, string> = {
  'form.create':        'bg-emerald-50 text-emerald-700',
  'form.update':        'bg-blue-50 text-blue-700',
  'form.delete':        'bg-red-50 text-red-600',
  'form.publish':       'bg-emerald-50 text-emerald-700',
  'submission.review':  'bg-blue-50 text-blue-700',
  'submission.flag':    'bg-amber-50 text-amber-700',
  'report.create':      'bg-purple-50 text-purple-700',
  'report.update':      'bg-purple-50 text-purple-700',
  'import.create':      'bg-orange-50 text-orange-700',
  'import.update':      'bg-orange-50 text-orange-700',
  'user.invite':        'bg-teal-50 text-teal-700',
  'user.role_change':   'bg-teal-50 text-teal-700',
  'user.remove':        'bg-red-50 text-red-600',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  form: 'Form', report: 'Report', submission: 'Submission',
  import_job: 'Import', program_membership: 'Member', program: 'Program',
}

export function AuditClient() {
  const { currentProgram, currentRole } = useProgram()
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState('')

  const canView = currentRole && ['super_admin', 'program_admin'].includes(currentRole)

  const fetchLogs = useCallback(async () => {
    if (!currentProgram) return
    setLoading(true)
    const params = new URLSearchParams({ program_id: currentProgram.id, limit: '100' })
    if (entityFilter) params.set('entity_type', entityFilter)
    const res = await fetch(`/api/audit?${params}`)
    if (res.ok) setLogs(await res.json())
    setLoading(false)
  }, [currentProgram, entityFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  if (!canView) {
    return (
      <div className="max-w-3xl px-8 py-8">
        <p className="text-[14px] text-gray-500">You don&apos;t have permission to view the audit log.</p>
      </div>
    )
  }

  const entityTypes = ['', 'form', 'report', 'submission', 'import_job', 'program_membership']

  return (
    <div className="max-w-4xl px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Audit Log</h1>
          <p className="mt-0.5 text-[14px] text-gray-500">Activity trail for {currentProgram?.name}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-[13px]"
          onClick={fetchLogs}
          disabled={loading}
          aria-label="Refresh audit log"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {entityTypes.map(et => (
          <button
            key={et || 'all'}
            onClick={() => setEntityFilter(et)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
              entityFilter === et
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
            aria-pressed={entityFilter === et}
          >
            {et ? (ENTITY_TYPE_LABELS[et] ?? et) : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <ScrollText className="mx-auto h-8 w-8 text-gray-200 mb-3" aria-hidden="true" />
          <p className="text-[14px] font-medium text-gray-500">No activity recorded yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden" role="list">
          {logs.map((log, i) => {
            const colorClass = ACTION_COLORS[log.action] ?? 'bg-gray-50 text-gray-600'
            const entityLabel = ENTITY_TYPE_LABELS[log.entity_type] ?? log.entity_type
            return (
              <div
                key={log.id}
                role="listitem"
                className={`flex items-start gap-4 px-5 py-3.5 ${i < logs.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${colorClass}`}>
                      {log.action}
                    </span>
                    <span className="text-[12px] text-gray-500">{entityLabel}</span>
                    {log.entity_id && (
                      <span className="text-[11px] text-gray-300 font-mono truncate max-w-[120px]">
                        {log.entity_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                  {log.diff && typeof log.diff === 'object' && Object.keys(log.diff).length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {Object.entries(log.diff as Record<string, unknown>)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {log.user_id && (
                    <p className="text-[11px] text-gray-400 font-mono">{log.user_id.slice(0, 8)}…</p>
                  )}
                  <p className="text-[11px] text-gray-300 mt-0.5">
                    {format(new Date(log.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
