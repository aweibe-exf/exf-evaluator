import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const anthropic = new Anthropic()
const MAX_EXTRACTED_CHARS = 12000

const schema = z.object({
  note_id: z.string().min(1),
  attachment_index: z.number().int().min(0),
})

async function extractPdfFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`)
    const arrayBuffer = await res.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            } as unknown as Anthropic.TextBlockParam,
            {
              type: 'text',
              text: 'Extract all text content from this PDF document. Output only the raw text, preserving paragraph breaks. Do not add commentary, headings, or formatting beyond what is in the original document.',
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return text.length > 0 ? text.slice(0, MAX_EXTRACTED_CHARS) : null
  } catch (err) {
    console.error('[reextract] extraction failed:', err)
    return null
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { note_id, attachment_index } = parsed.data

  // Fetch the note (RLS ensures caller has access)
  const { data: note } = await supabase
    .from('pulse_notes')
    .select('id, attachments')
    .eq('id', note_id)
    .single()
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const attachments = (note.attachments as Array<{
    name?: string; url?: string; type?: string; size?: number; extracted_text?: string | null
  }>) ?? []

  const attachment = attachments[attachment_index]
  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  if (attachment.type !== 'application/pdf') return NextResponse.json({ error: 'Not a PDF' }, { status: 400 })
  if (!attachment.url) return NextResponse.json({ error: 'No URL on attachment' }, { status: 400 })

  const extractedText = await extractPdfFromUrl(attachment.url)
  if (!extractedText) return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 422 })

  // Patch just that attachment in the array
  const updated = attachments.map((a, i) =>
    i === attachment_index ? { ...a, extracted_text: extractedText } : a
  )

  const { error: updateError } = await service
    .from('pulse_notes')
    .update({ attachments: updated })
    .eq('id', note_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ extracted_text: extractedText })
}
