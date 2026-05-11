import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')
  const entityType = searchParams.get('entity_type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (programId) query = query.eq('program_id', programId)
  if (entityType) query = query.eq('entity_type', entityType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
