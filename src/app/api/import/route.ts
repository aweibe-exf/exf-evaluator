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

/**
 * Local heuristic pre-classifier.
 * Runs before the AI call and assigns a best-guess type based on column name
 * patterns and sample values. The AI prompt then shows these hints so Claude
 * can confirm or override rather than starting cold.
 */
function heuristicType(header: string, sampleValues: unknown[]): string {
  const h = header.toLowerCase().trim()
  const nonEmpty = sampleValues.filter(v => v !== null && v !== undefined && v !== '')

  // --- Email ---
  if (/email/i.test(h)) return 'email'
  if (nonEmpty.some(v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) return 'email'

  // --- Name ---
  if (/^(name|full.?name|respondent.?name|participant.?name|contact.?name)$/i.test(h)) return 'name'

  // --- Date ---
  if (/date|timestamp|recorded.?on|submitted.?on/i.test(h)) return 'date'
  if (nonEmpty.some(v => typeof v === 'string' && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(v.trim()))) return 'date'

  // --- Identifier ---
  if (/\b(id|identifier|record.?#|record.?no|ref(erence)?)\b/i.test(h)) return 'identifier'

  // --- Boolean (Yes/No) ---
  if (nonEmpty.length > 0 && nonEmpty.every(v =>
    typeof v === 'string' && /^(yes|no|y|n|true|false)$/i.test(v.trim())
  )) return 'boolean'

  // --- Number: header-name signals ---
  // "#", "# of", "#of", "number of", "no. of", "count of", "total", "how many"
  if (/^#/.test(h)) return 'number'                                      // starts with #
  if (/\b(#\s*of|number\s*of|no\.\s*of|count\s*of|how\s+many)\b/i.test(h)) return 'number'
  if (/\b(total|sum|quantity|qty|amount|volume|revenue|sales|cost|budget|funding|grant|award)\b/i.test(h)) return 'number'
  if (/\b(rate|percentage|percent|ratio|proportion)\b/i.test(h)) return 'number'
  if (/\b(attendance|enrollment|participants|attendees|served|reached|trained|completed)\b/i.test(h)) return 'number'
  if (/\b(hours|days|weeks|months|years|acres|miles|units|lbs|tons)\b/i.test(h)) return 'number'
  if (/\%$/.test(h.trim())) return 'number'

  // --- Scale: satisfaction / rating columns ---
  if (/\b(satisf|rating|score|rank|rate|nps|likert|scale)\b/i.test(h)) return 'scale'

  // --- Number: sample values look numeric (incl. shorthand) ---
  const numericPattern = /^[$]?[\d,]+(\.\d+)?[KkMmBb]?[%]?$|^\d+(\.\d+)?[KkMmBb]$/
  if (nonEmpty.length > 0 && nonEmpty.every(v => typeof v === 'string' && numericPattern.test(v.trim()))) return 'number'

  // --- Single/multiple choice: low cardinality non-numeric repeated values ---
  const uniqueStrings = new Set(nonEmpty.map(v => String(v).trim().toLowerCase()))
  if (uniqueStrings.size <= 6 && nonEmpty.length >= 3) {
    const allShort = [...uniqueStrings].every(s => s.length < 40)
    if (allShort) return 'single_choice'
  }

  return 'text'
}

async function detectSchema(
  fileName: string,
  preview: Record<string, unknown>[]
): Promise<{ detected_schema: Record<string, string>; column_mappings: Record<string, string> }> {
  const headers = Object.keys(preview[0] ?? {})
  const sample = preview.slice(0, 5)

  // Build per-column hints from the local heuristic
  const hints = headers.map(h => {
    const values = preview.map(row => row[h])
    const guess = heuristicType(h, values)
    return `  "${h}": ${guess}  ← heuristic guess`
  }).join('\n')

  const prompt = `You are a data analyst mapping CSV columns to a survey evaluation system field types.

File: ${fileName}

Columns and heuristic guesses (confirm or correct each):
${hints}

Sample rows (first 5):
${JSON.stringify(sample, null, 2)}

Field types available:
- text: open-ended prose answer
- number: any count, quantity, total, rate, percentage, monetary value, or measurement
  → USE THIS when the column header starts with "#", contains "# of", "number of",
    "count of", "total", "how many", "participants", "served", "hours", "rate",
    "percentage", "%", "amount", "revenue", "acres", "units", or similar
  → USE THIS when sample values contain numeric shorthand like "300K", "$1.5M", "75%"
- date: date or timestamp
- email: email address
- name: person's name
- identifier: unique ID or record number
- single_choice: one option from a fixed set (low-cardinality text column)
- multiple_choice: multiple options selected
- scale: numeric satisfaction/rating score (1–5, 1–10, NPS, etc.)
- boolean: yes/no or true/false

Instructions:
1. Start from the heuristic guesses above — only change them when you have a clear reason.
2. Pay close attention to column names: "# of sites", "Total Participants", "Acres Restored",
   "% Complete", "Revenue Generated", "How many attended" → all should be "number".
3. Return a JSON object with exactly these two keys:
   - "detected_schema": maps each column name to its final field type
   - "column_mappings": maps each column name to a clean snake_case label

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
    // Fall back to pure heuristic if JSON parse fails
    const fallback: Record<string, string> = {}
    headers.forEach(h => {
      const values = preview.map(row => row[h])
      fallback[h] = heuristicType(h, values)
    })
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
