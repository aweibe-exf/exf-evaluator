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
 * JotForm and Google Forms render via JavaScript — their form data lives inside
 * <script> tags, not in HTML form elements. Stripping scripts (as a generic HTML
 * cleaner would) throws away everything useful.
 *
 * This function pulls out the highest-signal content to send Claude:
 * 1. Platform-specific embedded data blobs (JotForm JF.options, Google FB_PUBLIC_LOAD_DATA_)
 * 2. Any script blocks that mention "question", "field", or "form"
 * 3. Stripped HTML for everything else
 */
function buildExtractionContent(html: string, url: string): string {
  const parts: string[] = []

  // ── JotForm: form data is in window.JF / JF.options ───────────────────────
  // Matches: JF.options = {...}  or  window.JF={...}
  const jfOptionsMatch = html.match(/JF\s*(?:\.\s*options)?\s*=\s*(\{[\s\S]{50,200000})/i)
  if (jfOptionsMatch) {
    // Grab up to 40k chars — enough for large forms
    parts.push('=== JotForm embedded data (JF.options) ===\n' + jfOptionsMatch[1].slice(0, 100_000))
  }

  // ── Google Forms: FB_PUBLIC_LOAD_DATA_ ────────────────────────────────────
  const gfMatch = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]+?);\s*<\/script>/i)
  if (gfMatch) {
    parts.push('=== Google Forms embedded data (FB_PUBLIC_LOAD_DATA_) ===\n' + gfMatch[1].slice(0, 40_000))
  }

  // ── Generic: any script block referencing questions/fields ────────────────
  if (parts.length === 0) {
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi
    let m: RegExpExecArray | null
    while ((m = scriptPattern.exec(html)) !== null) {
      const content = m[1]
      if (/question|field|survey|form/i.test(content) && content.length > 100) {
        parts.push('=== Script block ===\n' + content.slice(0, 10_000))
        if (parts.join('').length > 40_000) break
      }
    }
  }

  // ── Stripped HTML (always included as fallback) ───────────────────────────
  const strippedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, parts.length > 0 ? 10_000 : 60_000)  // minimal HTML when we have script data

  parts.push('=== Page HTML ===\n' + strippedHtml)

  return parts.join('\n\n').slice(0, MAX_CONTENT_CHARS)
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
