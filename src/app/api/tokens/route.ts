import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendTokenEmail } from '@/lib/email'
import { logAudit } from '@/lib/audit'

const createTokenSchema = z.object({
  form_id: z.string().min(1),
  email: z.string().email(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = createTokenSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { form_id, email, metadata } = parsed.data

  // Fetch form + program name for the email
  const { data: form } = await supabase
    .from('forms')
    .select('id, name, slug, status, program_id, programs(name)')
    .eq('id', form_id)
    .single()

  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 })

  // Insert token
  const { data: tokenRow, error } = await service
    .from('submission_tokens')
    .insert({
      form_id,
      email,
      metadata: (metadata ?? {}) as never,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send email
  const programName = (form.programs as { name: string } | null)?.name ?? 'Extension Pulse'
  try {
    await sendTokenEmail({
      to: email,
      formName: form.name,
      programName,
      token: tokenRow.token,
      formSlug: form.slug,
      expiresAt: tokenRow.expires_at,
    })
    await service.from('submission_tokens').update({ sent_at: new Date().toISOString() }).eq('id', tokenRow.id)
  } catch (e) {
    console.error('Email send failed:', e)
  }

  await logAudit(service, {
    userId: user.id,
    programId: form.program_id,
    action: 'token.create',
    entityType: 'submission_token',
    entityId: tokenRow.id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ id: tokenRow.id, sent: true }, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const formId = searchParams.get('form_id')
  if (!formId) return NextResponse.json({ error: 'form_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('submission_tokens')
    .select('*')
    .eq('form_id', formId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
