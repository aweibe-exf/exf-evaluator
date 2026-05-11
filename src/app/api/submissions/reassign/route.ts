import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const schema = z.object({
  from_email: z.string().email(),
  to_email: z.string().email(),
  program_id: z.string().min(1),
  // Optional: scope to a specific form only
  form_id: z.string().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { from_email, to_email, program_id, form_id } = parsed.data

  // Find matching submissions via form's program_id
  let query = service
    .from('submissions')
    .select('id, forms!inner(program_id)')
    .eq('respondent_email', from_email)
    .eq('forms.program_id', program_id)

  if (form_id) query = query.eq('form_id', form_id)

  const { data: matches, error: findErr } = await query
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

  if (!matches || matches.length === 0) {
    return NextResponse.json({ updated: 0 })
  }

  const ids = matches.map(s => s.id)

  // Update all matched submissions
  const { error: updateErr } = await service
    .from('submissions')
    .update({ respondent_email: to_email })
    .in('id', ids)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await logAudit(service, {
    userId: user.id,
    programId: program_id,
    action: 'submissions.reassign',
    entityType: 'submission',
    entityId: ids[0],
    diff: { from_email, to_email, count: ids.length, form_id },
  })

  return NextResponse.json({ updated: ids.length })
}
