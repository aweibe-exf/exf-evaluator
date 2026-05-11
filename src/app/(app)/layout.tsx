import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ProgramProvider } from '@/contexts/program-context'
import { Sidebar } from '@/components/layout/sidebar'
import { Toaster } from '@/components/ui/sonner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Respondents (no program memberships) belong in /my, not the admin area
  const service = createServiceClient()
  const { count } = await service
    .from('program_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) === 0) redirect('/my')

  return (
    <ProgramProvider>
      <div className="flex h-screen overflow-hidden bg-[#f7f7f8]">
        <Sidebar userEmail={user.email} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <Toaster richColors position="bottom-right" />
    </ProgramProvider>
  )
}
