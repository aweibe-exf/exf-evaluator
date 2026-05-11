import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { data, error } = await service.from('programs').insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    brand_color: parsed.data.brand_color ?? '#ea580c',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-enroll creator as super_admin
  await service.from('program_memberships').insert({
    program_id: data.id,
    user_id: user.id,
    role: 'super_admin',
  })

  await logAudit(service, {
    userId: user.id,
    action: 'program.create',
    entityType: 'program',
    entityId: data.id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(data, { status: 201 })
}
