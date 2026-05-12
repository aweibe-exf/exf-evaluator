import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GuideClient } from './guide-client'

export default async function GuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  return <GuideClient />
}
