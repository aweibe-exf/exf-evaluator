import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { FormSchema } from '@/types/forms'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')
  const formId = searchParams.get('form_id')
  const status = searchParams.get('status')

  if (!programId) return NextResponse.json({ error: 'program_id required' }, { status: 400 })

  // Fetch forms for this program to get field labels
  const { data: forms } = await supabase
    .from('forms')
    .select('id, name, schema')
    .eq('program_id', programId)

  const formMap = new Map((forms ?? []).map(f => [f.id, f]))

  let query = supabase
    .from('submissions')
    .select('id, form_id, status, submitted_at, data, submission_tokens(email)')
    .order('submitted_at', { ascending: false })

  if (formId) {
    query = query.eq('form_id', formId)
  } else {
    const formIds = (forms ?? []).map(f => f.id)
    if (formIds.length === 0) return new NextResponse('', { status: 200 })
    query = query.in('form_id', formIds)
  }

  const validStatuses = ['draft', 'submitted', 'reviewed'] as const
  type SubmissionStatus = typeof validStatuses[number]
  if (status && validStatuses.includes(status as SubmissionStatus)) {
    query = query.eq('status', status as SubmissionStatus)
  }

  const { data: submissions, error } = await query.limit(5000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!submissions?.length) {
    return new NextResponse('id,form,email,status,submitted_at\n', {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="submissions.csv"',
      },
    })
  }

  // Build a union of all field labels across all forms in the export
  const fieldLabels = new Map<string, string>()
  for (const form of forms ?? []) {
    const schema = form.schema as unknown as FormSchema | null
    schema?.pages.flatMap(p => p.fields).forEach(f => {
      if (!fieldLabels.has(f.id)) fieldLabels.set(f.id, f.label || f.type)
    })
  }

  const fieldIds = Array.from(fieldLabels.keys())

  function escCsv(v: unknown): string {
    const s = Array.isArray(v) ? v.join('; ') : String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const headers = [
    'id', 'form', 'email', 'status', 'submitted_at',
    ...fieldIds.map(fid => fieldLabels.get(fid) ?? fid),
  ]

  const rows = submissions.map(sub => {
    const formName = formMap.get(sub.form_id)?.name ?? sub.form_id
    const email = (sub.submission_tokens as { email: string } | null)?.email ?? ''
    const data = (sub.data ?? {}) as Record<string, unknown>
    return [
      sub.id,
      formName,
      email,
      sub.status,
      sub.submitted_at ?? '',
      ...fieldIds.map(fid => data[fid] ?? ''),
    ].map(escCsv).join(',')
  })

  const csv = [headers.map(escCsv).join(','), ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="submissions-${programId.slice(0, 8)}.csv"`,
    },
  })
}
