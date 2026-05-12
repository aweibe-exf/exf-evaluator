import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'pulse-note-attachments'
const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
const MAX_EXTRACTED_CHARS = 12000  // ~3k tokens — enough for AI context

const anthropic = new Anthropic()

/**
 * Extract text from a PDF using Claude's native document understanding.
 * Much more reliable than pdf-parse in serverless environments, and handles
 * scanned PDFs, tables, and complex layouts.
 */
async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const base64 = buffer.toString('base64')
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
    console.warn('[upload] PDF text extraction failed:', err)
    return null
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const programId = formData.get('program_id') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!programId) return NextResponse.json({ error: 'program_id required' }, { status: 400 })

  // Verify program membership
  const { count } = await supabase
    .from('program_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId)
    .eq('user_id', user.id)
  if ((count ?? 0) === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 413 })
  }

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF and image files are allowed' }, { status: 415 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const fileName = `${user.id}/${programId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Extract text from PDFs using Claude (non-fatal if it fails)
  const extractedText = file.type === 'application/pdf'
    ? await extractPdfText(buffer)
    : null

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('[upload] Storage upload error:', uploadError)
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from(BUCKET).getPublicUrl(fileName)

  return NextResponse.json({
    name: file.name,
    url: publicUrl,
    size: file.size,
    type: file.type,
    extracted_text: extractedText,
  }, { status: 201 })
}
