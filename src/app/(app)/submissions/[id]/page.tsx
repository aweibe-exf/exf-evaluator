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

  const schema = raw.forms?.schema as unknown as FormSchema | null

  return (
    <SubmissionDetailClient
      submission={raw as unknown as Parameters<typeof SubmissionDetailClient>[0]['submission']}
      schema={schema}
    />
  )
}
