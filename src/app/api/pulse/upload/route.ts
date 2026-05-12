import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'pulse-note-attachments'
const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
const MAX_EXTRACTED_CHARS = 12000  // ~3k tokens — enough for AI context

/** Extract text from a PDF buffer. Dynamic import avoids webpack bundling pdf-parse. */
async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const fn = typeof pdfParse === 'function' ? pdfParse : pdfParse.default
    const parsed = await fn(buffer)
    const raw = (parsed.text as string | undefined)?.replace(/\s+/g, ' ').trim() ?? ''
    return raw.length > 0 ? raw.slice(0, MAX_EXTRACTED_CHARS) : null
  } catch (err) {
    console.warn('PDF text extraction failed:', err)
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

  // Extract text from PDFs (non-fatal if it fails)
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
    console.error('Storage upload error:', uploadError)
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
