'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Flag, CheckCircle, RotateCcw, UserRoundCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'
import type { FormSchema, FormField } from '@/types/forms'

type Status = 'draft' | 'submitted' | 'reviewed' | 'flagged'

interface Submission {
  id: string
  status: Status
  effectiveStatus?: Status   // derived: 'flagged' if metadata.flagged, else status
  respondent_email: string | null
  submitted_at: string | null
  created_at: string
  data: Record<string, unknown>
  forms: { name: string; slug: string } | null
  submission_tokens: { email: string; metadata: Record<string, unknown> | null } | null
}

interface Props {
  submission: Submission
  schema: FormSchema | null
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  submitted: { label: 'Submitted',  className: 'bg-blue-50 text-blue-700 border-blue-100' },
  reviewed:  { label: 'Reviewed',   className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  flagged:   { label: 'Flagged',    className: 'bg-amber-50 text-amber-700 border-amber-100' },
  draft:     { label: 'Draft',      className: 'bg-zinc-50 text-zinc-500 border-zinc-200' },
}

function formatAnswer(field: FormField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function SubmissionDetailClient({ submission: initial, schema }: Props) {
  const router = useRouter()
  const [submission, setSubmission] = useState(initial)
  const [updating, setUpdating] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const [reassignEmail, setReassignEmail] = useState('')
  const [reassignBusy, setReassignBusy] = useState(false)

  const allFields: FormField[] = schema?.pages.flatMap(p => p.fields) ?? []
  const data = (submission.data ?? {}) as Record<string, unknown>
  // Use effectiveStatus (which accounts for metadata.flagged) for display
  const displayStatus = submission.effectiveStatus ?? submission.status
  const cfg = statusConfig[displayStatus] ?? statusConfig.draft

  async function setStatus(status: Status) {
    setUpdating(true)
    const res = await fetch(`/api/submissions/${submission.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setUpdating(false)
    if (res.ok) {
      const updated = await res.json()
      // effectiveStatus comes back from the API already derived
      setSubmission(s => ({ ...s, status: updated.status, effectiveStatus: updated.effectiveStatus ?? updated.status }))
      toast.success(`Marked as ${status}`)
    } else {
      toast.error('Failed to update status')
    }
  }

  async function handleReassign() {
    const email = reassignEmail.trim()
    if (!email) return
    setReassignBusy(true)
    const res = await fetch(`/api/submissions/${submission.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respondent_email: email }),
    })
    setReassignBusy(false)
    if (res.ok) {
      setSubmission(s => ({ ...s, respondent_email: email }))
      setReassigning(false)
      setReassignEmail('')
      toast.success(`Reassigned to ${email}`)
    } else {
      toast.error('Failed to reassign submission')
    }
  }

  return (
    <div className="max-w-3xl px-8 py-8">
      {/* Back */}
      <button
        onClick={() => router.push('/submissions')}
        className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 transition-colors mb-6 focus:outline-none focus-visible:underline"
        aria-label="Back to submissions"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Submissions
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-gray-900 mb-1">
            {submission.respondent_email ?? 'Anonymous'}
          </h1>
          <p className="text-[13px] text-gray-400">
            {submission.forms?.name} ·{' '}
            {submission.submitted_at
              ? `Submitted ${format(new Date(submission.submitted_at), 'MMM d, yyyy h:mm a')}`
              : `Started ${formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}`}
          </p>
        </div>
        <span className={cn('rounded-full border px-2.5 py-1 text-[12px] font-medium flex-shrink-0', cfg.className)}
          aria-label={`Status: ${cfg.label}`}>
          {cfg.label}
        </span>
      </div>

      {/* Actions */}
      {displayStatus !== 'reviewed' && displayStatus !== 'flagged' && (
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[13px] h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            onClick={() => setStatus('reviewed')}
            disabled={updating}
          >
            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Mark reviewed
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[13px] h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
            onClick={() => setStatus('flagged')}
            disabled={updating}
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            Flag
          </Button>
        </div>
      )}
      {(displayStatus === 'reviewed' || displayStatus === 'flagged') && (
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[13px] h-8 text-gray-500"
            onClick={() => setStatus('submitted')}
            disabled={updating}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset to submitted
          </Button>
        </div>
      )}

      {/* Reassign */}
      <div className="mb-6">
        {!reassigning ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[13px] h-8 text-gray-400 hover:text-gray-700"
            onClick={() => { setReassigning(true); setReassignEmail(submission.respondent_email ?? '') }}
          >
            <UserRoundCog className="h-3.5 w-3.5" aria-hidden="true" />
            Reassign to someone else
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="email"
              value={reassignEmail}
              onChange={e => setReassignEmail(e.target.value)}
              placeholder="new@email.com"
              className="h-8 text-[13px] max-w-xs"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleReassign(); if (e.key === 'Escape') setReassigning(false) }}
              aria-label="New respondent email"
            />
            <Button
              size="sm"
              className="h-8 text-[13px] bg-orange-600 hover:bg-orange-700"
              onClick={handleReassign}
              disabled={reassignBusy || !reassignEmail.trim() || reassignEmail.trim() === submission.respondent_email}
              aria-busy={reassignBusy}
            >
              {reassignBusy ? 'Saving…' : 'Reassign'}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-[13px]" onClick={() => setReassigning(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Responses */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <h2 className="text-[13px] font-semibold text-gray-600 uppercase tracking-wider">Responses</h2>
        </div>
        <dl className="divide-y divide-gray-50">
          {allFields
            .filter(f => !['section_header', 'instructional_text', 'spacer'].includes(f.type))
            .map(field => (
              <div key={field.id} className="px-5 py-3.5 grid grid-cols-5 gap-4">
                <dt className="col-span-2 text-[13px] font-medium text-gray-500 leading-snug">{field.label || field.type}</dt>
                <dd className="col-span-3 text-[13px] text-gray-800">{formatAnswer(field, data[field.id])}</dd>
              </div>
            ))}
          {allFields.filter(f => !['section_header', 'instructional_text', 'spacer'].includes(f.type)).length === 0 && (
            <div className="px-5 py-8 text-center text-[13px] text-gray-400">No field definitions found for this form.</div>
          )}
        </dl>
      </div>

      {/* Metadata */}
      <div className="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <h2 className="text-[13px] font-semibold text-gray-600 uppercase tracking-wider">Details</h2>
        </div>
        <dl className="divide-y divide-gray-50">
          {[
            { label: 'Email', value: submission.respondent_email ?? '—' },
            { label: 'Form', value: submission.forms?.name ?? '—' },
            { label: 'Submission ID', value: submission.id },
            { label: 'IP address', value: (submission as unknown as Record<string, unknown>).ip_address as string ?? '—' },
          ].map(row => (
            <div key={row.label} className="px-5 py-3 grid grid-cols-5 gap-4">
              <dt className="col-span-2 text-[12px] font-medium text-gray-400">{row.label}</dt>
              <dd className="col-span-3 text-[12px] text-gray-600 font-mono break-all">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
