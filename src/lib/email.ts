const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL ?? `EXF Evaluator <noreply@${MAILGUN_DOMAIN}>`
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002'

interface SendTokenEmailParams {
  to: string
  formName: string
  programName: string
  token: string
  formSlug: string
  expiresAt: string
}

export async function sendTokenEmail(params: SendTokenEmailParams): Promise<void> {
  const { to, formName, programName, token, formSlug, expiresAt } = params
  const link = `${APP_URL}/f/${formSlug}?token=${token}`
  const expiry = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.log(`\n[EMAIL - no Mailgun key set]\nTo: ${to}\nSubject: Your form link — ${formName}\nLink: ${link}\n`)
    return
  }

  const text = [
    `You've been invited to complete a form for ${programName}.`,
    '',
    `Form: ${formName}`,
    `Link: ${link}`,
    '',
    `This link is personal to you and expires on ${expiry}.`,
    'Do not share it with others.',
  ].join('\n')

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#111;">
  <h2 style="font-size:20px;margin-bottom:8px;">${formName}</h2>
  <p style="color:#555;margin-bottom:24px;">You've been invited to complete a form for <strong>${programName}</strong>.</p>
  <a href="${link}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Open form</a>
  <p style="margin-top:24px;font-size:13px;color:#888;">This link is personal to you and expires ${expiry}. Do not share it.</p>
  <p style="font-size:12px;color:#aaa;margin-top:8px;">If the button doesn't work, copy this link: ${link}</p>
</body>
</html>`

  const form = new FormData()
  form.append('from', FROM_EMAIL)
  form.append('to', to)
  form.append('subject', `Your form link — ${formName}`)
  form.append('text', text)
  form.append('html', html)

  const res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}` },
    body: form,
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Mailgun error ${res.status}: ${detail}`)
  }
}
