import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'pulse-note-attachments'
const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

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
  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from(BUCKET).getPublicUrl(fileName)

  return NextResponse.json({
    name: file.name,
    url: publicUrl,
    size: file.size,
    type: file.type,
  }, { status: 201 })
}
