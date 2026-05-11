import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')
  if (!programId) return NextResponse.json({ error: 'program_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Fetch form IDs for this program
  const { data: forms, error: formsError } = await service
    .from('forms')
    .select('id')
    .eq('program_id', programId)

  if (formsError) return NextResponse.json({ error: formsError.message }, { status: 500 })
  if (!forms || forms.length === 0) return NextResponse.json({})

  const formIds = forms.map(f => f.id)

  // Fetch tokens for those forms
  const { data: tokens, error: tokensError } = await service
    .from('submission_tokens')
    .select('form_id, used_at, expires_at')
    .in('form_id', formIds)

  if (tokensError) return NextResponse.json({ error: tokensError.message }, { status: 500 })

  const now = new Date()
  const stats: Record<string, { completed: number; pending: number }> = {}

  for (const tok of tokens ?? []) {
    if (!stats[tok.form_id]) stats[tok.form_id] = { completed: 0, pending: 0 }
    if (tok.used_at !== null) {
      stats[tok.form_id].completed++
    } else if (new Date(tok.expires_at) > now) {
      stats[tok.form_id].pending++
    }
  }

  return NextResponse.json(stats)
}
