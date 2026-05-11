import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

export async function logAudit(
  supabase: SupabaseClient<Database>,
  {
    userId,
    programId,
    action,
    entityType,
    entityId,
    diff,
    ipAddress,
  }: {
    userId?: string
    programId?: string
    action: string
    entityType: string
    entityId?: string
    diff?: Record<string, unknown>
    ipAddress?: string
  }
) {
  await supabase.from('audit_log').insert({
    user_id: userId,
    program_id: programId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    diff: diff !== undefined ? diff as unknown as Json : null,
    ip_address: ipAddress,
  })
}
