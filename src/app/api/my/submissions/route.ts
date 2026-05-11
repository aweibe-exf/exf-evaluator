import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Link any submissions that still aren't owned (belt-and-suspenders in case the
  // auth callback ran before the submission was created, or the user arrived via a
  // different flow that bypassed the callback linking step).
  if (user.email) {
    const service = createServiceClient()
    await service
      .from('submissions')
      .update({ submitted_by: user.id })
      .eq('respondent_email', user.email)
      .is('submitted_by', null)
  }

  // Query by user ID (covers both linked rows and any just linked above),
  // plus any remaining unlinked rows that share the email — using service client
  // so RLS doesn't hide rows where submitted_by is still null.
  const service = createServiceClient()
  const { data, error } = await service
    .from('submissions')
    .select('id, status, submitted_at, data, form_id, forms(name, slug, programs(name))')
    .or(`submitted_by.eq.${user.id},respondent_email.eq.${user.email ?? ''}`)
    .order('submitted_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
