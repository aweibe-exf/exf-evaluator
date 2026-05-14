import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { Json } from '@/types/database'

const schema = z.object({
  program_id: z.string().min(1),
  url: z.string().url(),
  form_name: z.string().min(1).max(200).optional(),
})

const anthropic = new Anthropic()

const MAX_CONTENT_CHARS = 150_000

/**
 * JotForm and Google Forms render via JavaScript — the form data lives in
 * <script> tags, not in HTML <input>/<select> elements.
 *
 * Strategy: extract ALL script blocks, rank by how many form-related keywords
 * they contain, and send the most relevant ones to Claude. This works regardless
 * of the exact variable name the platform uses (JF.options, JFForm, etc.).
 */
function buildExtractionContent(html: string, url: string): string {
  // Collect all non-trivial script blocks
  const scripts: { content: string; score: number }[] = []
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = scriptPattern.exec(html)) !== null) {
    const content = m[1].trim()
    if (content.length < 50) continue
    // Score by count of form-relevant keywords
    const score = (content.match(/question|field|choice|option|label|survey|answer|matrix|required|checkbox|radio|dropdown|textbox|textarea/gi) ?? []).length
    scripts.push({ content, score })
  }

  // Sort highest-signal first
  scripts.sort((a, b) => b.score - a.score)

  // Build script section: take scripts until we hit ~120k chars
  const scriptParts: string[] = []
  let scriptBudget = 120_000
  for (const { content } of scripts) {
    if (scriptBudget <= 0) break
    const chunk = content.slice(0, scriptBudget)
    scriptParts.push(chunk)
    scriptBudget -= chunk.length
  }

  // Stripped HTML as a supplementary signal (page title, visible labels, etc.)
  const strippedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 15_000)

  const scriptSection = scriptParts.join('\n\n--- next script block ---\n\n')
  return `=== SCRIPT BLOCKS (ranked by form-data relevance) ===\n${scriptSection}\n\n=== PAGE HTML ===\n${strippedHtml}`.slice(0, MAX_CONTENT_CHARS)
}

async function extractFormFromHtml(url: string, html: string): Promise<{
  title: string
  pages: Array<{
    id: string
    title: string
    fields: Array<Record<string, unknown>>
  }>
}> {
  const content = buildExtractionContent(html, url)

  const prompt = `You are extracting a form's structure from a web page so it can be recreated in Extension Pulse.

Source URL: ${url}

IMPORTANT: Many form platforms (JotForm, Google Forms, Typeform) render via JavaScript.
The actual form data is often embedded inside <script> tags as JSON or JavaScript objects —
NOT as visible HTML <input> / <select> elements. Look carefully at any "JotForm embedded data",
"Google Forms embedded data", or "Script block" sections in the content below.

For JotForm: questions are in JF.options.questions — a JSON object keyed by question ID.
  Each question has: type (control_textbox, control_radio, control_checkbox, control_dropdown,
  control_matrix, control_rating, control_email, control_number, control_date, control_head, etc.),
  text (the question label), required ("Yes"/"No"), and answers (options for choice fields).

For Google Forms: FB_PUBLIC_LOAD_DATA_ is a nested array. Questions are in index 1, each with
  a title and type code (0=short text, 1=long text, 2=single choice, 3=dropdown, 4=multiple choice,
  5=linear scale, 7=grid/matrix, 9=date).

Page content:
${content}

Return ONLY a valid JSON object with this shape:

{
  "title": "Form title",
  "pages": [
    {
      "id": "page-1",
      "title": "",
      "fields": [
        {
          "id": "field-1",
          "label": "Question text",
          "type": "short_text",
          "required": false,
          "hidden": false,
          "helpText": "",
          "options": []
        }
      ]
    }
  ]
}

Field type mapping:
- Short answer / single-line / control_textbox / control_email → use "short_text" or "email"
- Paragraph / long text / control_textarea → "long_text"
- Radio buttons / pick one / control_radio → "single_choice"
- Checkboxes / select all / control_checkbox → "multiple_choice"
- Dropdown / control_dropdown → "dropdown"
- Number / control_number → "number"
- Date / control_date → "date"
- Rating / scale / control_rating / control_scale → "rating"
- Matrix / grid / control_matrix → "matrix" (include matrixRows and matrixColumns arrays)
- Section heading / control_head / page header → "section_header"
- Instructions / description → "instructional_text"

For choice fields, populate "options": [{"id":"opt-1","label":"Option","value":"option_slug"}]
For matrix: add "matrixRows":[{"id":"row-1","label":"..."}], "matrixColumns":[{"id":"col-1","label":"..."}]

Use sequential IDs: field-1, field-2 ... opt-1, opt-2 ...
Skip: submit buttons, CAPTCHA, progress bars, hidden system fields.
Return ONLY valid JSON, no markdown fences.`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  const stripped = text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(stripped)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { program_id, url, form_name } = parsed.data

  // Verify program membership
  const { count } = await supabase
    .from('program_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', program_id)
    .eq('user_id', user.id)
  if ((count ?? 0) === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch the HTML from the public URL
  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not load that URL (HTTP ${res.status}). Make sure the form is set to public/anyone with the link.` },
        { status: 422 }
      )
    }
    html = await res.text()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return NextResponse.json({ error: `Failed to fetch URL: ${msg}` }, { status: 422 })
  }

  // Extract form structure with Claude
  let extracted: Awaited<ReturnType<typeof extractFormFromHtml>>
  try {
    extracted = await extractFormFromHtml(url, html)
  } catch {
    return NextResponse.json(
      { error: 'Could not extract a form structure from that URL. Make sure it points directly to a form.' },
      { status: 422 }
    )
  }

  const allFields = extracted.pages?.flatMap(p => p.fields ?? []) ?? []
  if (allFields.length === 0) {
    return NextResponse.json(
      { error: 'No form fields were found at that URL. The form may require login or use a format the extractor cannot read.' },
      { status: 422 }
    )
  }

  // Create the form
  const finalName = form_name?.trim() || extracted.title || 'Imported Form'
  const slug = `imported-${finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now().toString(36)}`

  const { data: form, error: formError } = await service.from('forms').insert({
    name: finalName,
    program_id,
    slug,
    schema: extracted as unknown as Json,
    settings: { isImported: true, importedFromUrl: url } as unknown as Json,
    status: 'active',
    created_by: user.id,
  }).select('id, slug').single()

  if (formError || !form) {
    return NextResponse.json({ error: formError?.message ?? 'Failed to create form' }, { status: 500 })
  }

  await logAudit(service, {
    userId: user.id,
    programId: program_id,
    action: 'form.create',
    entityType: 'form',
    entityId: form.id,
  })

  return NextResponse.json({
    form_id: form.id,
    form_slug: form.slug,
    title: finalName,
    field_count: allFields.length,
  }, { status: 201 })
}
