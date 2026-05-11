import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { Json } from '@/types/database'

const updateFormSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
})

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('forms').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = updateFormSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data: existing } = await supabase.from('forms').select('program_id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await service.from('forms').update(parsed.data as unknown as { schema?: Json; settings?: Json; name?: string; description?: string | null; status?: 'draft' | 'active' | 'closed' }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (parsed.data.status) {
    await logAudit(service, {
      userId: user.id,
      programId: existing.program_id,
      action: `form.${parsed.data.status === 'active' ? 'publish' : 'update'}`,
      entityType: 'form',
      entityId: id,
      diff: parsed.data,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await supabase.from('forms').select('program_id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await service.from('forms').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(service, {
    userId: user.id,
    programId: existing.program_id,
    action: 'form.delete',
    entityType: 'form',
    entityId: id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return new NextResponse(null, { status: 204 })
}
