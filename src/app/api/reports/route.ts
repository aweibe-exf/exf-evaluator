import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { Json } from '@/types/database'

const createReportSchema = z.object({
  program_id: z.string().min(1),
  name: z.string().min(1).max(200),
  date_from: z.string().min(1),
  date_to: z.string().min(1),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')

  let query = supabase.from('reports').select('*').order('updated_at', { ascending: false })
  if (programId) query = query.eq('program_id', programId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = createReportSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const initialContent = { sections: [] }

  const { data, error } = await service.from('reports').insert({
    program_id: parsed.data.program_id,
    name: parsed.data.name,
    date_from: parsed.data.date_from,
    date_to: parsed.data.date_to,
    content: initialContent as unknown as Json,
    status: 'draft',
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(service, {
    userId: user.id,
    programId: parsed.data.program_id,
    action: 'report.create',
    entityType: 'report',
    entityId: data.id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(data, { status: 201 })
}
