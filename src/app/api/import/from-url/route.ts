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

// Cap HTML sent to Claude — most forms are well under this
const MAX_HTML_CHARS = 80_000

async function extractFormFromHtml(url: string, html: string): Promise<{
  title: string
  pages: Array<{
    id: string
    title: string
    fields: Array<Record<string, unknown>>
  }>
}> {
  // Strip script/style tags and compress whitespace to reduce token count
  const cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, MAX_HTML_CHARS)

  const prompt = `You are extracting a form's structure from HTML so it can be recreated in Extension Pulse.

Source URL: ${url}

HTML:
${cleaned}

Return ONLY a valid JSON object (no markdown, no explanation) with this exact shape:

{
  "title": "Form title here",
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

Field type rules:
- Short answer / single-line text → "short_text"
- Paragraph / multi-line text → "long_text"
- Radio buttons / pick one → "single_choice"
- Checkboxes / select all that apply → "multiple_choice"
- Dropdown select → "dropdown"
- Number input → "number"
- Date picker → "date"
- Email → "email"
- Linear scale / star rating → "rating"
- Grid / matrix (rows × columns) → "matrix"
- Section title / heading → "section_header"
- Instructions / description text → "instructional_text"

For choice fields (single_choice, multiple_choice, dropdown), populate "options":
[{"id": "opt-1", "label": "Option text", "value": "option_text_slug"}]

For matrix fields, also include:
"matrixRows": [{"id": "row-1", "label": "Row label"}],
"matrixColumns": [{"id": "col-1", "label": "Column label"}],
"matrixType": "radio"

Use sequential IDs: field-1, field-2, field-3 ... and opt-1, opt-2 ...
Set "required": true only for questions explicitly marked as required.
Omit fields that are purely decorative (progress bars, submit buttons, CAPTCHA).
Return ONLY valid JSON.`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
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
