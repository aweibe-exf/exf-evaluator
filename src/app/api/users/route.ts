import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const inviteSchema = z.object({
  program_id: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['program_admin', 'staff', 'viewer']),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')
  if (!programId) return NextResponse.json({ error: 'program_id required' }, { status: 400 })

  const { data: memberships, error } = await supabase
    .from('program_memberships')
    .select('id, role, user_id, created_at')
    .eq('program_id', programId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch user emails from auth.users via service client
  const service = createServiceClient()
  const userIds = memberships?.map(m => m.user_id) ?? []
  const userEmails: Record<string, string> = {}

  if (userIds.length > 0) {
    const { data: { users } } = await service.auth.admin.listUsers()
    users?.forEach(u => { userEmails[u.id] = u.email ?? '' })
  }

  const result = memberships?.map(m => ({
    ...m,
    email: userEmails[m.user_id] ?? '',
  })) ?? []

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { program_id, email, role } = parsed.data

  // Check if user already exists in auth
  const { data: { users: existing } } = await service.auth.admin.listUsers()
  let targetUserId = existing?.find(u => u.email === email)?.id

  if (!targetUserId) {
    // Invite user via magic link — creates the user
    const { data: invited, error: invErr } = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    })
    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })
    targetUserId = invited.user.id
  }

  // Upsert membership
  const { data, error } = await service.from('program_memberships').upsert({
    program_id,
    user_id: targetUserId,
    role,
  }, { onConflict: 'program_id,user_id' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(service, {
    userId: user.id,
    programId: program_id,
    action: 'user.invite',
    entityType: 'program_membership',
    entityId: data.id,
    diff: { email, role } as Record<string, unknown>,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ ...data, email }, { status: 201 })
}
