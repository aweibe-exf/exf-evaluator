import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { FormSchema, FormField } from '@/types/forms'

const schema = z.object({
  program_id: z.string().min(1),
  form_id: z.string().min(1).optional(),           // single form (impact dashboard compat)
  form_ids: z.array(z.string()).optional(),         // multi-select (report editor)
  date_from: z.string().min(1),
  date_to: z.string().min(1),
  summary_type: z.enum(['key_themes', 'trend', 'impact_story', 'logic_model']),
})

const client = new Anthropic()

const DOC_TYPE_LABELS: Record<string, string> = {
  narrative: 'Grant Narrative',
  logic_model: 'Logic Model',
  continuation: 'Continuation Document',
  evaluation: 'Evaluation Plan',
  budget: 'Budget Narrative',
  other: 'Supporting Document',
}

interface NarrativeContext {
  title: string
  content: string
  document_type: string
  starts_at: string
  ends_at: string
}

function buildPrompt(
  type: string,
  programName: string,
  formName: string,
  dateFrom: string,
  dateTo: string,
  submissions: Record<string, unknown>[],
  fields: FormField[],
  narratives?: NarrativeContext[]
): string {
  const fieldMap = Object.fromEntries(fields.map(f => [f.id, f.label || f.type]))

  // Convert raw submission data to human-readable Q&A pairs
  const readable = submissions.slice(0, 100).map((sub, i) => {
    const data = sub.data as Record<string, unknown>
    const answers = Object.entries(data)
      .map(([fid, val]) => {
        const label = fieldMap[fid] ?? fid
        const answer = Array.isArray(val) ? val.join(', ') : String(val ?? '')
        return answer ? `  ${label}: ${answer}` : null
      })
      .filter(Boolean)
      .join('\n')
    return `Respondent ${i + 1}:\n${answers || '  (no data)'}`
  }).join('\n\n')

  // Prepend matched award documents as grounding context
  const narrativeSection = narratives?.length
    ? `AWARD CONTEXT DOCUMENTS:\nThe following documents cover this reporting period. Use them together to ground your analysis in the program's stated goals, theory of change, and intended outcomes.\n\n${narratives.map(n => {
        const typeLabel = DOC_TYPE_LABELS[n.document_type] ?? 'Document'
        return `[${typeLabel}: ${n.title} (${n.starts_at} – ${n.ends_at})]:\n${n.content}`
      }).join('\n\n---\n\n')}\n\n===\n\n`
    : ''

  const context = `${narrativeSection}Program: ${programName}\nForm: ${formName}\nPeriod: ${dateFrom} to ${dateTo}\nTotal responses: ${submissions.length}\n\n${readable}`

  const prompts: Record<string, string> = {
    trend: `You are an analyst for an extension education program. Based on the following survey responses, write a concise trend analysis (3-5 paragraphs) identifying key patterns, changes over time, and notable findings. Use specific data points where possible. Where award narrative context is provided, connect findings to the program's stated goals. Write for program administrators.\n\n${context}`,
    impact_story: `You are a program evaluator. Based on the following survey responses, write a compelling impact narrative (3-5 paragraphs) that highlights real outcomes and benefits for participants and the community. Include specific examples. Where award narrative context is provided, frame outcomes in relation to the program's stated objectives and intended impact. Write for funders and stakeholders.\n\n${context}`,
    logic_model: `You are a program evaluator. Based on the following survey responses, produce a structured logic model summary with these sections: Inputs, Activities, Outputs, Short-term Outcomes, Long-term Outcomes. Use bullet points within each section. Where award narrative context is provided, ensure the logic model reflects the program's stated theory of change. Base it on the actual data.\n\n${context}`,
    key_themes: `You are a qualitative researcher. Based on the following survey responses, identify and describe the 4-6 most prominent themes. For each theme: give it a name, summarize it in 2-3 sentences, and note how many responses reflect it. Where award narrative context is provided, note whether themes align with or diverge from the program's stated goals. Write clearly for a general audience.\n\n${context}`,
  }

  return prompts[type] ?? prompts.key_themes
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { program_id, form_id, form_ids, date_from, date_to, summary_type } = parsed.data

  // Fetch program name
  const { data: program } = await supabase.from('programs').select('name').eq('id', program_id).single()
  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

  // Resolve which form IDs to query
  // Priority: form_ids array > single form_id > all forms in program
  let effectiveFormIds: string[] | null = null
  if (form_ids && form_ids.length > 0) {
    effectiveFormIds = form_ids
  } else if (form_id) {
    effectiveFormIds = [form_id]
  }

  // Fetch submissions in date range
  let subQuery = supabase
    .from('submissions')
    .select('data, submitted_at, forms(name, schema)')
    .eq('status', 'submitted')
    .gte('submitted_at', date_from)
    .lte('submitted_at', date_to + 'T23:59:59Z')

  if (effectiveFormIds) {
    subQuery = subQuery.in('form_id', effectiveFormIds)
  } else {
    // Fall back to all forms in the program
    const { data: programForms } = await supabase.from('forms').select('id').eq('program_id', program_id)
    const programFormIds = programForms?.map(f => f.id) ?? []
    if (programFormIds.length === 0) return NextResponse.json({ error: 'No forms found for this program' }, { status: 404 })
    subQuery = subQuery.in('form_id', programFormIds)
  }

  const { data: submissions, error: subErr } = await subQuery
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })
  if (!submissions?.length) return NextResponse.json({ error: 'No submissions found in this date range' }, { status: 404 })

  // Aggregate fields from all returned forms (for multi-form analysis)
  const seenSchemas = new Set<string>()
  const fields: FormField[] = []
  const formNames: string[] = []
  submissions.forEach(s => {
    const f = s.forms as { name: string; schema: unknown } | null
    if (!f) return
    if (!seenSchemas.has(f.name)) {
      seenSchemas.add(f.name)
      formNames.push(f.name)
      const schema = f.schema as FormSchema | null
      fields.push(...(schema?.pages.flatMap(p => p.fields) ?? []))
    }
  })
  const formName = formNames.length === 1 ? formNames[0] : `${formNames.length} forms`

  // Fetch award context documents that overlap the reporting period
  const { data: narratives } = await service
    .from('program_narratives')
    .select('title, content, document_type, starts_at, ends_at')
    .eq('program_id', program_id)
    .lte('starts_at', date_to)
    .gte('ends_at', date_from)
    .order('starts_at', { ascending: true })

  const prompt = buildPrompt(
    summary_type,
    program.name,
    formName,
    date_from,
    date_to,
    submissions as Record<string, unknown>[],
    fields,
    narratives ?? []
  )

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0].type === 'text' ? message.content[0].text : ''

  const dbSummaryType: 'submission' | 'trend' | 'impact' | 'report_section' =
    summary_type === 'trend' ? 'trend'
    : summary_type === 'impact_story' ? 'impact'
    : summary_type === 'logic_model' ? 'report_section'
    : 'submission'

  // Persist to ai_summaries — only store form_id when a single form was queried
  const persistFormId = effectiveFormIds?.length === 1 ? effectiveFormIds[0] : (form_id ?? null)
  const { data: saved, error: saveErr } = await service.from('ai_summaries').insert({
    program_id,
    form_id: persistFormId,
    date_from,
    date_to,
    summary_type: dbSummaryType,
    content,
    model_version: message.model,
  }).select().single()

  if (saveErr) console.error('Failed to save summary:', saveErr.message)

  return NextResponse.json({ content, id: saved?.id ?? null })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')
  const formId = searchParams.get('form_id')

  let query = supabase.from('ai_summaries').select('*').order('created_at', { ascending: false })
  if (programId) query = query.eq('program_id', programId)
  if (formId) query = query.eq('form_id', formId)

  const { data, error } = await query.limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
