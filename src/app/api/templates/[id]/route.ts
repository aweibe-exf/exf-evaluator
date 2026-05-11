import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/types/database'

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
  is_archived: z.boolean().optional(),
  is_global: z.boolean().optional(),
})

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = updateTemplateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  type TemplateUpdate = Database['public']['Tables']['form_templates']['Update']
  const updatePayload: TemplateUpdate = {
    name: parsed.data.name,
    description: parsed.data.description,
    is_archived: parsed.data.is_archived,
    is_global: parsed.data.is_global,
    ...(parsed.data.schema !== undefined ? { schema: parsed.data.schema as unknown as Json } : {}),
  }
  const { data, error } = await service.from('form_templates').update(updatePayload).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await service.from('form_templates').update({ is_archived: true }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
