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
      const { count } = await service
        .from('program_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', data.user.id)

      const destination = (count ?? 0) > 0 ? next : '/my'
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
