import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('program_narratives')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data: existing } = await supabase.from('program_narratives').select('program_id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await service
    .from('program_narratives')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(service, {
    userId: user.id,
    programId: existing.program_id,
    action: 'narrative.update',
    entityType: 'program_narrative',
    entityId: id,
  })

  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await supabase.from('program_narratives').select('program_id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await service.from('program_narratives').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(service, {
    userId: user.id,
    programId: existing.program_id,
    action: 'narrative.delete',
    entityType: 'program_narrative',
    entityId: id,
  })

  return NextResponse.json({ success: true })
}
