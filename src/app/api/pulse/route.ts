import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

const createSchema = z.object({
  program_id: z.string().min(1),
  content: z.string().min(1).max(50000),
  source: z.enum(['typed', 'voice', 'google_doc', 'attachment']).default('typed'),
  note_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  google_doc_url: z.string().url().optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    size: z.number(),
    type: z.string(),
  })).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')
  if (!programId) return NextResponse.json({ error: 'program_id required' }, { status: 400 })

  // RLS handles visibility: authors see own, admins see all
  const { data, error } = await supabase
    .from('pulse_notes')
    .select('*')
    .eq('program_id', programId)
    .order('note_date', { ascending: false })
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
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { program_id, content, source, note_date, google_doc_url, attachments } = parsed.data

  // Verify membership
  const { count } = await supabase
    .from('program_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', program_id)
    .eq('user_id', user.id)
  if ((count ?? 0) === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await service
    .from('pulse_notes')
    .insert({
      program_id,
      author_id: user.id,
      author_email: user.email ?? null,
      content,
      source,
      note_date: note_date ?? new Date().toISOString().slice(0, 10),
      google_doc_url: google_doc_url ?? null,
      attachments: (attachments ?? []) as Json,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
