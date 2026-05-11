import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendReviewerFeedbackEmail } from '@/lib/email'
import type { Json } from '@/types/database'

const schema = z.object({
  comment: z.string().min(1).max(2000),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { comment } = parsed.data

  // Fetch the submission + form info
  const { data: submission, error: fetchErr } = await service
    .from('submissions')
    .select('id, respondent_email, metadata, forms(name, program_id, programs(name))')
    .eq('id', id)
    .single()

  if (fetchErr || !submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

  const recipientEmail = submission.respondent_email
  if (!recipientEmail) {
    return NextResponse.json({ error: 'No email address on this submission — cannot send feedback' }, { status: 422 })
  }

  const form = submission.forms as { name: string; program_id: string; programs: { name: string } | null } | null
  const formName = form?.name ?? 'your form'
  const programName = form?.programs?.name ?? 'the program'

  // Send the email
  try {
    await sendReviewerFeedbackEmail({
      to: recipientEmail,
      reviewerName: user.email ?? 'A reviewer',
      formName,
      programName,
      comment,
    })
  } catch (e) {
    console.error('Failed to send reviewer feedback email:', e)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  // Persist: save comment + feedbackSentAt in metadata
  const existingMeta = ((submission.metadata ?? {}) as Record<string, unknown>)
  await service.from('submissions').update({
    metadata: {
      ...existingMeta,
      reviewerComment: comment,
      feedbackSentAt: new Date().toISOString(),
      feedbackSentBy: user.email ?? user.id,
    } as Json,
  }).eq('id', id)

  return NextResponse.json({ sent: true, to: recipientEmail })
}
