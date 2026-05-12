import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PulseClient } from './pulse-client'

export default async function PulsePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  return <PulseClient />
}
