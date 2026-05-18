import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = user.email
  if (!email) return NextResponse.json([])

  // Find pending (unused, not expired) tokens assigned to this user's email
  const { data: tokens, error } = await service
    .from('submission_tokens')
    .select(`
      id,
      token,
      expires_at,
      forms (
        id,
        name,
        slug,
        settings,
        programs ( name )
      )
    `)
    .eq('email', email)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(tokens ?? [])
}
