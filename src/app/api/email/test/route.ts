import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().min(1),
})

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL ?? `Extension Pulse <noreply@${MAILGUN_DOMAIN}>`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const { to, subject, html, text } = parsed.data

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.log(`[TEST EMAIL]\nTo: ${to}\nSubject: ${subject}\n${text}`)
    return NextResponse.json({ sent: false, note: 'Mailgun not configured — logged to console' })
  }

  const form = new FormData()
  form.append('from', FROM_EMAIL)
  form.append('to', to)
  form.append('subject', `[TEST] ${subject}`)
  form.append('text', text)
  form.append('html', html)

  const res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}` },
    body: form,
  })

  if (!res.ok) {
    const detail = await res.text()
    return NextResponse.json({ error: `Mailgun error ${res.status}: ${detail}` }, { status: 502 })
  }

  return NextResponse.json({ sent: true })
}
