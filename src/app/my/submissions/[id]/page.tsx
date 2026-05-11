import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubmissionDetailClient } from './submission-detail-client'

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/my/submissions/${id}`)
  return <SubmissionDetailClient submissionId={id} userEmail={user.email ?? ''} />
}
