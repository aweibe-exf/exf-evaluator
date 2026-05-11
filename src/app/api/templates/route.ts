import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/types/database'

const createTemplateSchema = z.object({
  program_id: z.string().min(1).nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  schema: z.record(z.string(), z.unknown()),
  is_global: z.boolean().optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')

  const { data, error } = await supabase
    .from('form_templates')
    .select('*')
    .eq('is_archived', false)
    .or(programId ? `program_id.eq.${programId},is_global.eq.true` : 'is_global.eq.true')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = createTemplateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  type TemplateInsert = Database['public']['Tables']['form_templates']['Insert']
  const insertPayload: TemplateInsert = {
    name: parsed.data.name,
    description: parsed.data.description,
    program_id: parsed.data.program_id ?? null,
    schema: parsed.data.schema as unknown as Json,
    is_global: parsed.data.is_global,
    created_by: user.id,
  }
  const { data, error } = await service.from('form_templates').insert(insertPayload).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
