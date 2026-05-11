import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { Json } from '@/types/database'

const initSchema = z.object({
  program_id: z.string().min(1),
  file_name: z.string().min(1),
  file_url: z.string(),
  preview_data: z.array(z.record(z.string(), z.unknown())),
  row_count: z.number().int().min(0),
  period_type: z.enum(['month', 'quarter']).optional(),
  period_value: z.string().optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
})

const anthropic = new Anthropic()

async function detectSchema(
  fileName: string,
  preview: Record<string, unknown>[]
): Promise<{ detected_schema: Record<string, string>; column_mappings: Record<string, string> }> {
  const headers = Object.keys(preview[0] ?? {})
  const sample = preview.slice(0, 5)

  const prompt = `You are a data analyst helping to map CSV/Excel columns to a survey evaluation system.

File: ${fileName}
Columns: ${headers.join(', ')}

Sample rows (first 5):
${JSON.stringify(sample, null, 2)}

The evaluation system stores submissions with these field types:
- text: open-ended text answer
- number: numeric value
- date: date value (YYYY-MM-DD)
- email: email address
- single_choice: one selected option
- multiple_choice: multiple selected options
- scale: numeric rating (1-10)
- boolean: yes/no value
- name: respondent name
- identifier: unique ID / record number

Return a JSON object with two keys:
1. "detected_schema": maps each column name to its detected field type
2. "column_mappings": maps each column name to a clean, normalized label (snake_case, descriptive)

Example:
{
  "detected_schema": { "Q1: How satisfied?": "scale", "Email Address": "email" },
  "column_mappings": { "Q1: How satisfied?": "satisfaction_score", "Email Address": "respondent_email" }
}

Return only valid JSON, no explanation.`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    const fallback: Record<string, string> = {}
    headers.forEach(h => { fallback[h] = 'text' })
    return { detected_schema: fallback, column_mappings: fallback }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = initSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { program_id, file_name, file_url, preview_data, row_count, period_type, period_value, period_start, period_end } = parsed.data

  // Only pass first 10 rows to AI for schema detection
  const aiResult = await detectSchema(file_name, (preview_data as Record<string, unknown>[]).slice(0, 10))

  const columnMappings: Record<string, string> = { ...aiResult.column_mappings }
  if (period_type) columnMappings._period_type = period_type
  if (period_value) columnMappings._period_value = period_value
  if (period_start) columnMappings._period_start = period_start
  if (period_end) columnMappings._period_end = period_end

  const { data, error } = await service.from('import_jobs').insert({
    program_id,
    file_name,
    file_url: file_url || '',
    preview_data: preview_data as unknown as Json,
    row_count,
    detected_schema: aiResult.detected_schema as unknown as Json,
    column_mappings: columnMappings as unknown as Json,
    status: 'review',
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(service, {
    userId: user.id,
    programId: program_id,
    action: 'import.create',
    entityType: 'import_job',
    entityId: data.id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(data, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')

  let query = supabase.from('import_jobs').select('*').order('created_at', { ascending: false })
  if (programId) query = query.eq('program_id', programId)

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
