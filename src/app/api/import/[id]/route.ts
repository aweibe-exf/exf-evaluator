import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { Json } from '@/types/database'

const updateSchema = z.object({
  column_mappings: z.record(z.string(), z.string()).optional(),
  status: z.enum(['pending', 'processing', 'review', 'complete', 'failed']).optional(),
})

async function createFormFromImport(
  service: ReturnType<typeof createServiceClient>,
  job: { id: string; file_name: string; program_id: string; detected_schema: Json | null; row_count: number | null },
  columnMappings: Record<string, string>,
  userId: string,
) {
  const periodType = columnMappings._period_type
  const periodValue = columnMappings._period_value

  const dataFields = Object.entries(columnMappings).filter(([k]) => !k.startsWith('_period_'))
  const schema = (job.detected_schema ?? {}) as Record<string, string>

  const fields = dataFields.map(([col, mappedType], idx) => ({
    id: `field-${idx + 1}`,
    label: col,
    type: mappedType === 'skip' ? 'text' : mappedType,
    required: false,
    ...(mappedType === 'skip' ? { hidden: true } : {}),
  }))

  const baseName = job.file_name.replace(/\.[^.]+$/, '')
  const periodLabel = periodValue ? ` (${periodValue})` : ''
  const formName = `${baseName}${periodLabel}`
  const slug = `import-${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`

  const formSchema = { pages: [{ id: 'page-1', title: 'Imported Data', fields }] }
  const formSettings = {
    isImported: true,
    importJobId: job.id,
    importedRowCount: job.row_count,
    ...(periodType ? { periodType, periodValue } : {}),
  }

  await service.from('forms').insert({
    name: formName,
    program_id: job.program_id,
    slug,
    schema: formSchema as unknown as Json,
    settings: formSettings as unknown as Json,
    status: 'active',
    created_by: userId,
  })

  // Log separately for the auto-created form
  await logAudit(service, {
    userId,
    programId: job.program_id,
    action: 'form.create',
    entityType: 'form',
    entityId: job.id,
  })
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('import_jobs').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { data: job } = await supabase
    .from('import_jobs')
    .select('program_id, file_name, detected_schema, column_mappings, row_count')
    .eq('id', id)
    .single()
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type ImportUpdate = { column_mappings?: Json; status?: 'pending' | 'processing' | 'review' | 'complete' | 'failed' }
  const update: ImportUpdate = {}
  if (parsed.data.column_mappings) update.column_mappings = parsed.data.column_mappings as unknown as Json
  if (parsed.data.status) update.status = parsed.data.status

  const { data, error } = await service.from('import_jobs').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create a form when import is confirmed
  if (parsed.data.status === 'complete') {
    const finalMappings = (parsed.data.column_mappings ?? (job.column_mappings ?? {})) as Record<string, string>
    await createFormFromImport(service, { id, ...job }, finalMappings, user.id).catch(() => {
      // Non-fatal — form creation failure shouldn't block the import completion
    })
  }

  await logAudit(service, {
    userId: user.id,
    programId: job.program_id,
    action: 'import.update',
    entityType: 'import_job',
    entityId: id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(data)
}
