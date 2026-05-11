import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { FormSchema, FormField } from '@/types/forms'

const schema = z.object({
  program_id: z.string().min(1),
  form_id: z.string().min(1).optional(),
  date_from: z.string().min(1),
  date_to: z.string().min(1),
  summary_type: z.enum(['key_themes', 'trend', 'impact_story', 'logic_model']),
})

const client = new Anthropic()

function buildPrompt(
  type: string,
  programName: string,
  formName: string,
  dateFrom: string,
  dateTo: string,
  submissions: Record<string, unknown>[],
  fields: FormField[]
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

  const context = `Program: ${programName}\nForm: ${formName}\nPeriod: ${dateFrom} to ${dateTo}\nTotal responses: ${submissions.length}\n\n${readable}`

  const prompts: Record<string, string> = {
    trend: `You are an analyst for an extension education program. Based on the following survey responses, write a concise trend analysis (3-5 paragraphs) identifying key patterns, changes over time, and notable findings. Use specific data points where possible. Write for program administrators.\n\n${context}`,
    impact_story: `You are a program evaluator. Based on the following survey responses, write a compelling impact narrative (3-5 paragraphs) that highlights real outcomes and benefits for participants and the community. Include specific examples. Write for funders and stakeholders.\n\n${context}`,
    logic_model: `You are a program evaluator. Based on the following survey responses, produce a structured logic model summary with these sections: Inputs, Activities, Outputs, Short-term Outcomes, Long-term Outcomes. Use bullet points within each section. Base it on the actual data.\n\n${context}`,
    key_themes: `You are a qualitative researcher. Based on the following survey responses, identify and describe the 4-6 most prominent themes. For each theme: give it a name, summarize it in 2-3 sentences, and note how many responses reflect it. Write clearly for a general audience.\n\n${context}`,
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

  const { program_id, form_id, date_from, date_to, summary_type } = parsed.data

  // Fetch program name
  const { data: program } = await supabase.from('programs').select('name').eq('id', program_id).single()
  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

  // Fetch submissions in date range
  let subQuery = supabase
    .from('submissions')
    .select('data, submitted_at, forms(name, schema)')
    .eq('status', 'submitted')
    .gte('submitted_at', date_from)
    .lte('submitted_at', date_to + 'T23:59:59Z')

  if (form_id) {
    subQuery = subQuery.eq('form_id', form_id)
  } else {
    // Filter by program via join — fetch form IDs first
    const { data: forms } = await supabase.from('forms').select('id').eq('program_id', program_id)
    const formIds = forms?.map(f => f.id) ?? []
    if (formIds.length === 0) return NextResponse.json({ error: 'No forms found for this program' }, { status: 404 })
    subQuery = subQuery.in('form_id', formIds)
  }

  const { data: submissions, error: subErr } = await subQuery
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })
  if (!submissions?.length) return NextResponse.json({ error: 'No submissions found in this date range' }, { status: 404 })

  // Get fields from form schema
  const firstForm = submissions[0]?.forms as { name: string; schema: unknown } | null
  const formSchema = firstForm?.schema as FormSchema | null
  const fields: FormField[] = formSchema?.pages.flatMap(p => p.fields) ?? []
  const formName = form_id
    ? (firstForm?.name ?? 'Unknown form')
    : `${program.name} (all forms)`

  const prompt = buildPrompt(
    summary_type,
    program.name,
    formName,
    date_from,
    date_to,
    submissions as Record<string, unknown>[],
    fields
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

  // Persist to ai_summaries
  const { data: saved, error: saveErr } = await service.from('ai_summaries').insert({
    program_id,
    form_id: form_id ?? null,
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
