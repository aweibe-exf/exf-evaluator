'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react'
import { format } from 'date-fns'
import type { FormSchema, FormField } from '@/types/forms'

interface Submission {
  id: string
  status: string
  submitted_at: string | null
  data: Record<string, unknown>
  forms: {
    name: string
    schema: unknown
    programs: { name: string } | null
  } | null
}

function renderAnswer(field: FormField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const DISPLAY_TYPES = new Set([
  'short_text', 'long_text', 'number', 'email', 'url', 'date',
  'single_choice', 'multiple_choice', 'dropdown', 'rating',
  'likert_scale', 'nps', 'slider', 'matrix',
])

export function SubmissionDetailClient({ submissionId, userEmail }: { submissionId: string; userEmail: string }) {
  const router = useRouter()
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/my/submissions/${submissionId}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        return r.ok ? r.json() : null
      })
      .then(data => { if (data) setSubmission(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [submissionId])

  const schema = submission?.forms?.schema as FormSchema | null
  const allFields: FormField[] = schema?.pages.flatMap(p => p.fields) ?? []
  const displayFields = allFields.filter(f => DISPLAY_TYPES.has(f.type))
  const data = submission?.data ?? {}

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/my')} aria-label="Back to my submissions">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div>
            <p className="text-[13px] font-semibold text-gray-800">
              {loading ? 'Loading…' : submission?.forms?.name ?? 'Submission'}
            </p>
            <p className="text-[11px] text-gray-400">{userEmail}</p>
          </div>
        </div>
        {submission && (
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
            {submission.status === 'submitted' || submission.status === 'reviewed'
              ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              : <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />}
            {submission.status === 'reviewed' ? 'Reviewed'
              : submission.status === 'submitted' ? 'Submitted'
              : 'Draft'}
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : notFound ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
            <p className="text-[14px] font-medium text-gray-500">Submission not found</p>
            <Button variant="ghost" size="sm" className="mt-3 text-orange-600" onClick={() => router.push('/my')}>
              Back to my submissions
            </Button>
          </div>
        ) : (
          <>
            {submission?.submitted_at && (
              <p className="text-[12px] text-gray-400 mb-6">
                Submitted {format(new Date(submission.submitted_at), 'MMMM d, yyyy \'at\' h:mm a')}
                {submission.forms?.programs?.name ? ` · ${submission.forms.programs.name}` : ''}
              </p>
            )}

            <div className="rounded-xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
              {displayFields.length === 0 ? (
                <div className="px-6 py-8 text-center text-[13px] text-gray-400">No responses to display.</div>
              ) : displayFields.map(field => (
                <div key={field.id} className="px-6 py-4">
                  <p className="text-[12px] font-medium text-gray-500 mb-1">{field.label}</p>
                  <p className="text-[14px] text-gray-800 whitespace-pre-wrap">
                    {renderAnswer(field, data[field.id])}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
