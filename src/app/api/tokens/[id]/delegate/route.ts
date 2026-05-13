import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { sendCollaborationEmail } from '@/lib/email'
import type { Json } from '@/types/database'

const schema = z.object({
  // Caller must supply the token string to prove they are the legitimate token holder.
  token: z.string().min(1),
  collaboratorEmail: z.string().email(),
  comment: z.string().max(1000).optional(),
  flaggedFieldIds: z.array(z.string()).optional(),
  currentData: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { token, collaboratorEmail, comment, flaggedFieldIds = [], currentData = {} } = parsed.data

  // Verify both the record ID and the token string — the caller must prove they
  // are the token holder, not just someone who guessed an internal record UUID.
  const { data: ownerToken } = await service
    .from('submission_tokens')
    .select('*, forms(name, slug, program_id, programs(name))')
    .eq('id', id)
    .eq('token', token)
    .single()

  if (!ownerToken) return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  if (ownerToken.used_at) return NextResponse.json({ error: 'This form has already been submitted' }, { status: 400 })

  const form = ownerToken.forms as { name: string; slug: string; program_id: string; programs: { name: string } | null } | null
  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 })

  // Create collaboration token for collaborator
  const collabToken = crypto.randomUUID()
  const collabMeta: Record<string, unknown> = {
    isCollaboration: true,
    ownerTokenId: id,
    ownerEmail: ownerToken.email,
    prefillData: currentData,
    flaggedFieldIds,
    delegationComment: comment ?? '',
  }

  const { data: collabTokenRow, error: insertErr } = await service
    .from('submission_tokens')
    .insert({
      form_id: ownerToken.form_id,
      email: collaboratorEmail,
      token: collabToken,
      expires_at: ownerToken.expires_at,
      metadata: collabMeta as Json,
    })
    .select()
    .single()

  if (insertErr || !collabTokenRow) {
    return NextResponse.json({ error: insertErr?.message ?? 'Failed to create collaboration token' }, { status: 500 })
  }

  // Update owner token metadata
  const existingMeta = (ownerToken.metadata ?? {}) as Record<string, unknown>
  const ownerMeta: Record<string, unknown> = {
    ...existingMeta,
    delegationStatus: 'delegated',
    collaboratorEmail,
    collaboratorTokenId: collabTokenRow.id,
    flaggedFieldIds,
    delegationComment: comment ?? '',
    ownerDraftData: currentData,
  }

  await service
    .from('submission_tokens')
    .update({ metadata: ownerMeta as Json })
    .eq('id', id)

  // Email the collaborator
  try {
    await sendCollaborationEmail({
      to: collaboratorEmail,
      ownerEmail: ownerToken.email,
      formName: form.name,
      programName: form.programs?.name ?? 'Extension Pulse',
      token: collabToken,
      formSlug: form.slug,
      expiresAt: ownerToken.expires_at,
      comment,
      flaggedFieldCount: flaggedFieldIds.length,
    })
  } catch (e) {
    console.error('Failed to send collaboration email:', e)
    // Non-fatal — token was created, just log
  }

  return NextResponse.json({ success: true, collaboratorEmail })
}
