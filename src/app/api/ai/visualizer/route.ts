import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { FormSchema, FormField } from '@/types/forms'

const schema = z.object({
  program_id: z.string().min(1),
  prompt: z.string().min(1).max(1000),
})

const client = new Anthropic()

// ---------------------------------------------------------------------------
// Data aggregation (same pattern as sidekick)
// ---------------------------------------------------------------------------

interface SubmissionRow {
  id: string
  submitted_at: string | null
  data: Record<string, unknown>
  form_id: string
}

interface FormMeta {
  id: string
  name: string
  fields: FormField[]
  settings: Record<string, unknown>
}

function numStats(vals: number[]) {
  if (!vals.length) return null
  const sum = vals.reduce((a, b) => a + b, 0)
  return { count: vals.length, sum: Math.round(sum * 100) / 100, avg: Math.round(sum / vals.length * 100) / 100, min: Math.min(...vals), max: Math.max(...vals) }
}

function buildDataContext(programName: string, forms: FormMeta[], submissions: SubmissionRow[]): string {
  const lines: string[] = [
    `PROGRAM: ${programName}`,
    `TOTAL SUBMISSIONS: ${submissions.length}`,
    `TOTAL FORMS: ${forms.length}`,
    '',
  ]

  const dates = submissions.map(s => s.submitted_at).filter(Boolean).sort() as string[]
  if (dates.length) {
    lines.push(`DATE RANGE: ${dates[0].slice(0, 10)} to ${dates[dates.length - 1].slice(0, 10)}`)
    lines.push('')
  }

  // Monthly submission counts overall
  const byMonth: Record<string, number> = {}
  for (const s of submissions) {
    const key = (s.submitted_at ?? '').slice(0, 7) || 'unknown'
    byMonth[key] = (byMonth[key] ?? 0) + 1
  }
  const months = Object.keys(byMonth).sort()
  if (months.length) {
    lines.push('MONTHLY SUBMISSION COUNTS:')
    for (const m of months) lines.push(`  ${m}: ${byMonth[m]}`)
    lines.push('')
  }

  // Per-form breakdown
  for (const form of forms) {
    const formRows = submissions.filter(s => s.form_id === form.id)
    if (!formRows.length) continue

    const pLabel = (() => {
      const s = form.settings
      if (s.periodValue) return ` [${s.periodValue}]`
      if (s.periodStart && s.periodEnd) return ` [${s.periodStart}–${s.periodEnd}]`
      return ''
    })()
    lines.push(`FORM: "${form.name}"${pLabel} — ${formRows.length} submissions`)

    // Monthly counts per form
    const fByMonth: Record<string, number> = {}
    for (const s of formRows) {
      const key = (s.submitted_at ?? '').slice(0, 7) || 'unknown'
      fByMonth[key] = (fByMonth[key] ?? 0) + 1
    }
    const fMonths = Object.keys(fByMonth).sort()
    if (fMonths.length > 1) {
      lines.push(`  Monthly: ${fMonths.map(m => `${m}=${fByMonth[m]}`).join(', ')}`)
    }

    for (const field of form.fields) {
      if ((field as unknown as Record<string, unknown>).hidden) continue
      const label = field.label || field.id
      const isNumeric = ['number', 'scale', 'rating', 'nps', 'slider'].includes(field.type)

      if (isNumeric) {
        const allVals = formRows.map(r => Number(r.data[field.id])).filter(v => !isNaN(v) && v !== 0)
        const stats = numStats(allVals)
        if (stats) lines.push(`  [${label}] numeric: n=${stats.count} sum=${stats.sum} avg=${stats.avg} min=${stats.min} max=${stats.max}`)

        // Monthly numeric trend
        const numByMonth: Record<string, number[]> = {}
        for (const s of formRows) {
          const key = (s.submitted_at ?? '').slice(0, 7) || 'unknown'
          const v = Number(s.data[field.id])
          if (!isNaN(v) && v !== 0) {
            numByMonth[key] = [...(numByMonth[key] ?? []), v]
          }
        }
        const numMonths = Object.keys(numByMonth).sort()
        if (numMonths.length > 1) {
          lines.push(`    Monthly avg: ${numMonths.map(m => {
            const vs = numByMonth[m]
            const avg = Math.round(vs.reduce((a, b) => a + b, 0) / vs.length * 10) / 10
            return `${m}=${avg}`
          }).join(', ')}`)
        }
      } else if (field.type === 'single_choice' || field.type === 'multiple_choice') {
        const dist: Record<string, number> = {}
        for (const row of formRows) {
          const val = row.data[field.id]
          const choices = Array.isArray(val) ? val : [val]
          for (const c of choices) {
            if (c) dist[String(c)] = (dist[String(c)] ?? 0) + 1
          }
        }
        const top = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 10)
        if (top.length) lines.push(`  [${label}] choices: ${top.map(([v, n]) => `"${v}"=${n}`).join(', ')}`)
      } else if (field.type === 'short_text' || field.type === 'long_text') {
        const samples = formRows.map(r => r.data[field.id]).filter(v => v && String(v).trim().length > 2).slice(0, 3)
        if (samples.length) lines.push(`  [${label}] text samples: ${samples.map(v => `"${String(v).slice(0, 60)}"`).join(' | ')}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Tool definition — forces Claude to return structured chart config
// ---------------------------------------------------------------------------

const VIZ_TOOL: Anthropic.Tool = {
  name: 'create_chart',
  description: 'Create a chart configuration from the program data to answer the user\'s question.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Concise chart title' },
      description: { type: 'string', description: 'One or two sentences explaining what the chart shows and the key insight' },
      chart_type: { type: 'string', enum: ['bar', 'line', 'area', 'pie'], description: 'Chart type: line/area for trends over time, bar for comparisons, pie for proportions' },
      data: {
        type: 'array',
        description: 'Array of data point objects. Each object must have the x_key field and all y_keys fields.',
        items: { type: 'object', additionalProperties: true },
      },
      x_key: { type: 'string', description: 'The field name used as the x-axis / label in each data object' },
      y_keys: { type: 'array', items: { type: 'string' }, description: 'One or more field names used as y-axis values. Multiple for multi-series charts.' },
      x_label: { type: 'string', description: 'Human-readable x-axis label' },
      y_label: { type: 'string', description: 'Human-readable y-axis label' },
      series_labels: { type: 'object', description: 'Optional map of y_key → display label for multi-series charts', additionalProperties: true },
    },
    required: ['title', 'description', 'chart_type', 'data', 'x_key', 'y_keys'],
  },
}

const SYSTEM_PROMPT = `You are a data visualization expert embedded in a program evaluation platform. Given real submission data and a natural language question, you create the best chart to answer it.

Chart type selection:
- "line" or "area": growth over time, trends, longitudinal comparisons
- "bar": comparing categories, side-by-side values, rankings
- "pie": proportions, distributions, percentages of a whole

Data rules:
- Use the actual numbers from the data context — do not invent values
- Aim for 4–20 data points for clarity
- For time-series, sort chronologically; months as "Jan 2024", "Feb 2024" etc.
- For multi-series bar charts, include multiple y_keys with clear names
- If the specific metric asked about isn't directly available, use the closest available data and note it in the description
- Labels must be human-readable strings`

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { program_id, prompt } = parsed.data

  const { data: program } = await supabase.from('programs').select('name').eq('id', program_id).single()
  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

  const { data: rawForms } = await supabase
    .from('forms')
    .select('id, name, schema, settings')
    .eq('program_id', program_id)
    .in('status', ['active', 'closed'])
    .order('created_at', { ascending: true })

  const forms: FormMeta[] = (rawForms ?? []).map(f => ({
    id: f.id,
    name: f.name,
    fields: ((f.schema as FormSchema | null)?.pages ?? []).flatMap(p => p.fields),
    settings: (f.settings ?? {}) as Record<string, unknown>,
  }))

  let submissions: SubmissionRow[] = []
  const formIds = forms.map(f => f.id)
  if (formIds.length > 0) {
    const { data: rawSubs } = await service
      .from('submissions')
      .select('id, form_id, submitted_at, data')
      .in('form_id', formIds)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true })
      .limit(3000)
    submissions = (rawSubs ?? []).map(s => ({
      id: s.id,
      form_id: s.form_id,
      submitted_at: s.submitted_at,
      data: s.data as Record<string, unknown>,
    }))
  }

  const context = buildDataContext(program.name, forms, submissions)
  const userMessage = `Data context:\n${context}\n\nUser request: ${prompt}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    tools: [VIZ_TOOL],
    tool_choice: { type: 'tool', name: 'create_chart' },
    messages: [{ role: 'user', content: userMessage }],
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'Could not generate a visualization for that query.' }, { status: 422 })
  }

  return NextResponse.json({ config: toolUse.input, prompt })
}
