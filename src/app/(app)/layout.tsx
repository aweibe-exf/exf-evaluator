import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProgramProvider } from '@/contexts/program-context'
import { Sidebar } from '@/components/layout/sidebar'
import { Toaster } from '@/components/ui/sonner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

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
