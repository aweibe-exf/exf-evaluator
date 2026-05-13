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

  // Verify the requesting user is an admin of the target program before touching
  // any data. Without this, any authenticated user could reassign submissions
  // across programs they don't belong to.
  const { count: memberCount } = await supabase
    .from('program_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', program_id)
    .eq('user_id', user.id)
    .in('role', ['super_admin', 'program_admin'])

  if ((memberCount ?? 0) === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Resolve form IDs for this program explicitly (filtering via joined table columns
  // is unreliable in PostgREST — use .in('form_id', ...) for hard isolation).
  const formQuery = service.from('forms').select('id').eq('program_id', program_id)
  if (form_id) formQuery.eq('id', form_id)
  const { data: programForms } = await formQuery
  const programFormIds = (programForms ?? []).map(f => f.id)
  if (programFormIds.length === 0) return NextResponse.json({ updated: 0 })

  // Find matching submissions scoped strictly to this program's forms
  const { data: matches, error: findErr } = await service
    .from('submissions')
    .select('id')
    .eq('respondent_email', from_email)
    .in('form_id', programFormIds)

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
