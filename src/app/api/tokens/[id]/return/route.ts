import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { sendReturnNotificationEmail } from '@/lib/email'
import type { Json } from '@/types/database'

const schema = z.object({
  data: z.record(z.string(), z.unknown()),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data: collaboratorAnswers } = parsed.data

  // Fetch collaboration token
  const { data: collabToken } = await service
    .from('submission_tokens')
    .select('*')
    .eq('id', id)
    .single()

  if (!collabToken) return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  if (collabToken.used_at) return NextResponse.json({ error: 'Already submitted' }, { status: 400 })

  const collabMeta = (collabToken.metadata ?? {}) as Record<string, unknown>
  if (!collabMeta.isCollaboration) return NextResponse.json({ error: 'Not a collaboration token' }, { status: 400 })

  const ownerTokenId = collabMeta.ownerTokenId as string
  const ownerEmail = collabMeta.ownerEmail as string
  const prefillData = (collabMeta.prefillData ?? {}) as Record<string, unknown>
  const flaggedFieldIds = (collabMeta.flaggedFieldIds ?? []) as string[]
  const delegationComment = collabMeta.delegationComment as string | undefined

  // Fetch owner token
  const { data: ownerToken } = await service
    .from('submission_tokens')
    .select('*, forms(name, slug)')
    .eq('id', ownerTokenId)
    .single()

  if (!ownerToken) return NextResponse.json({ error: 'Owner token not found' }, { status: 404 })

  // Merge: owner's draft answers as base, overlay collaborator's answers
  const mergedData: Record<string, unknown> = { ...prefillData, ...collaboratorAnswers }

  // Update owner token metadata → delegationStatus: 'returned'
  const existingOwnerMeta = (ownerToken.metadata ?? {}) as Record<string, unknown>
  const updatedOwnerMeta: Record<string, unknown> = {
    ...existingOwnerMeta,
    delegationStatus: 'returned',
    mergedData,
    collaboratorData: collaboratorAnswers,
    collaboratorEmail: collabToken.email,
    flaggedFieldIds,
    delegationComment,
  }

  await service
    .from('submission_tokens')
    .update({ metadata: updatedOwnerMeta as Json })
    .eq('id', ownerTokenId)

  // Mark collaboration token as used
  await service
    .from('submission_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id)

  // Email owner
  const form = ownerToken.forms as { name: string; slug: string } | null
  if (form && ownerEmail) {
    try {
      await sendReturnNotificationEmail({
        to: ownerEmail,
        collaboratorEmail: collabToken.email,
        formName: form.name,
        formSlug: form.slug,
        token: ownerToken.token,
      })
    } catch (e) {
      console.error('Failed to send return notification:', e)
    }
  }

  return NextResponse.json({ success: true })
}
