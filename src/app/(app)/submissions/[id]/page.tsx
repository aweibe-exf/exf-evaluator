import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubmissionDetailClient } from './submission-detail-client'
import type { FormSchema } from '@/types/forms'

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: raw } = await supabase
    .from('submissions')
    .select('*, forms(name, slug, schema, program_id), submission_tokens(email, metadata)')
    .eq('id', id)
    .single()

  if (!raw) notFound()

  const programId = (raw.forms as { program_id?: string } | null)?.program_id

  // Resolve the current user's role for this program
  let currentRole: string | null = null
  if (programId) {
    const { data: membership } = await supabase
      .from('program_memberships')
      .select('role')
      .eq('program_id', programId)
      .eq('user_id', user.id)
      .single()
    currentRole = membership?.role ?? null
  }

  const schema = raw.forms?.schema as unknown as FormSchema | null
  const meta = ((raw.metadata ?? {}) as Record<string, unknown>)
  const effectiveStatus = meta.flagged ? 'flagged' : raw.status

  return (
    <SubmissionDetailClient
      submission={{ ...(raw as unknown as Parameters<typeof SubmissionDetailClient>[0]['submission']), effectiveStatus: effectiveStatus as 'draft' | 'submitted' | 'reviewed' | 'flagged' }}
      schema={schema}
      currentRole={currentRole}
    />
  )
}
