import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

const saveSchema = z.object({
  program_id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  prompt: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')
  if (!programId) return NextResponse.json({ error: 'program_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('saved_visualizations')
    .select('*')
    .eq('program_id', programId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { program_id, title, description, prompt, config } = parsed.data

  const { data, error } = await supabase
    .from('saved_visualizations')
    .insert({
      program_id,
      created_by: user.id,
      created_by_email: user.email ?? null,
      title,
      description: description ?? null,
      prompt,
      config: config as Json,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
