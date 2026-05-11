import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendTokenEmail } from '@/lib/email'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await service.from('submission_tokens').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const action = body?.action

  if (action !== 'resend') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const { data: token } = await supabase
    .from('submission_tokens')
    .select('*, forms(name, slug, program_id, programs(name))')
    .eq('id', id)
    .single()

  if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = token.forms as { name: string; slug: string; program_id: string; programs: { name: string } | null } | null
  const programName = form?.programs?.name ?? 'Extension Foundation'

  try {
    await sendTokenEmail({
      to: token.email,
      formName: form?.name ?? 'Form',
      programName,
      token: token.token,
      formSlug: form?.slug ?? '',
      expiresAt: token.expires_at,
    })
    await service.from('submission_tokens').update({ sent_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ sent: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
