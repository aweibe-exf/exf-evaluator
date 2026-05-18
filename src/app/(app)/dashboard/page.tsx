import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Staff and viewers don't have a dashboard — send them straight to submissions
    const service = createServiceClient()
    const { data: membership } = await service
      .from('program_memberships')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (membership?.role === 'staff' || membership?.role === 'viewer') {
      redirect('/submissions')
    }
  }

  return <DashboardClient userId={user?.id} />
}
