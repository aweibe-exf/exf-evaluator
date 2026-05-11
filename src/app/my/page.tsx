import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RespondentPortal } from './respondent-portal'

export default async function MySubmissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/my')
  return <RespondentPortal userEmail={user.email ?? ''} />
}
