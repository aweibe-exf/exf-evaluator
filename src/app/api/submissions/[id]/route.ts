import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

const updateSchema = z.object({
  // 'flagged' is a UI-only concept stored in metadata.flagged; DB enum is draft|submitted|reviewed
  status: z.enum(['draft', 'submitted', 'reviewed', 'flagged']).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  respondent_email: z.string().email().nullable().optional(),
  reviewer_comment: z.string().max(2000).nullable().optional(),
})

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('submissions')
    .select('*, forms(name, slug, schema, program_id), submission_tokens(email, metadata)')
    .eq('id', id)
    .single()

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
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { status, data: newData, respondent_email, reviewer_comment } = parsed.data

  // 'flagged' is stored in metadata.flagged (not the DB enum) — fetch current row first
  const { data: existing } = await service.from('submissions').select('metadata').eq('id', id).single()
  const existingMeta = ((existing?.metadata ?? {}) as Record<string, unknown>)

  const update: Record<string, unknown> = {}
  if (status === 'flagged') {
    // Don't touch the DB status column — just set metadata.flagged = true
    update.metadata = { ...existingMeta, flagged: true } as Json
  } else if (status) {
    update.status = status
    // Clear flagged when explicitly setting reviewed or submitted
    update.metadata = { ...existingMeta, flagged: false } as Json
  }
  // Reviewer comment stored in metadata.reviewerComment
  if (reviewer_comment !== undefined) {
    const currentMeta = (update.metadata ?? existingMeta) as Record<string, unknown>
    update.metadata = { ...currentMeta, reviewerComment: reviewer_comment } as Json
  }
  if (newData) update.data = newData
  if (respondent_email !== undefined) update.respondent_email = respondent_email

  const { data, error } = await service
    .from('submissions')
    .update(update as never)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute and attach effectiveStatus for the client
  const meta = ((data.metadata ?? {}) as Record<string, unknown>)
  const effectiveStatus = meta.flagged ? 'flagged' : data.status
  return NextResponse.json({ ...data, effectiveStatus })
}
