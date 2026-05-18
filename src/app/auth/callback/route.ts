import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user?.email) {
      const service = createServiceClient()

      // Link any previously unowned submissions to this account
      await service
        .from('submissions')
        .update({ submitted_by: data.user.id })
        .eq('respondent_email', data.user.email)
        .is('submitted_by', null)

      // Respondents (no program memberships) go to their own portal
      const { data: memberships } = await service
        .from('program_memberships')
        .select('role')
        .eq('user_id', data.user.id)

      if (!memberships || memberships.length === 0) {
        return NextResponse.redirect(`${origin}/my`)
      }

      // Staff / viewer land on submissions; everyone else uses the requested `next`
      const role = memberships[0]?.role
      const destination = (role === 'staff' || role === 'viewer') ? '/submissions' : next
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
