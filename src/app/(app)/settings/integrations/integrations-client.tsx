'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Mail, Send, Eye, Code2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Template {
  key: string
  name: string
  description: string
  subject: string
  variables: string[]
  defaultBody: string
}

const TEMPLATES: Template[] = [
  {
    key: 'form_invite',
    name: 'Form Invitation',
    description: 'Sent when a respondent is invited to fill out a form via a unique token link.',
    subject: 'Your form link — {{form_name}}',
    variables: ['{{respondent_name}}', '{{form_name}}', '{{program_name}}', '{{form_link}}', '{{expiry_date}}'],
    defaultBody: `<p>Hello {{respondent_name}},</p>
<p>You've been invited to complete a form for <strong>{{program_name}}</strong>.</p>
<p><strong>Form:</strong> {{form_name}}</p>
<p style="margin:24px 0;">
  <a href="{{form_link}}" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Open form</a>
</p>
<p style="color:#888;font-size:13px;">This link is personal to you and expires {{expiry_date}}. Please do not share it with others.</p>`,
  },
  {
    key: 'submission_confirm',
    name: 'Submission Confirmation',
    description: 'Sent to a respondent after they successfully submit a form.',
    subject: 'Thanks for your submission — {{form_name}}',
    variables: ['{{respondent_name}}', '{{form_name}}', '{{program_name}}', '{{submitted_at}}'],
    defaultBody: `<p>Hello {{respondent_name}},</p>
<p>Thank you for completing <strong>{{form_name}}</strong> for <strong>{{program_name}}</strong>.</p>
<p>Your response was received on {{submitted_at}}.</p>
<p style="color:#888;font-size:13px;">If you have any questions, please contact your program administrator.</p>`,
  },
  {
    key: 'review_notify',
    name: 'Submission Reviewed',
    description: 'Sent to staff when a new submission arrives and is ready for review.',
    subject: 'New submission to review — {{form_name}}',
    variables: ['{{form_name}}', '{{program_name}}', '{{submitted_at}}', '{{review_link}}'],
    defaultBody: `<p>A new submission has been received for <strong>{{form_name}}</strong> in <strong>{{program_name}}</strong>.</p>
<p>Submitted: {{submitted_at}}</p>
<p style="margin:24px 0;">
  <a href="{{review_link}}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Review submission</a>
</p>`,
  },
]

const WRAPPER = (body: string, subject: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#111;background:#fff;">
  <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e5e5e5;">
    <p style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#888;margin:0;">EXF Evaluator</p>
    <h1 style="font-size:20px;font-weight:600;margin:8px 0 0;">${subject}</h1>
  </div>
  ${body}
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:11px;color:#aaa;">
    <p>Sent by EXF Evaluator · Extension Foundation</p>
  </div>
</body>
</html>`

export function IntegrationsClient() {
  const [selected, setSelected] = useState<Template>(TEMPLATES[0])
  const [subject, setSubject] = useState(TEMPLATES[0].subject)
  const [body, setBody] = useState(TEMPLATES[0].defaultBody)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [testEmail, setTestEmail] = useState('')
  const [sending, setSending] = useState(false)

  function selectTemplate(t: Template) {
    setSelected(t)
    setSubject(t.subject)
    setBody(t.defaultBody)
    setMode('edit')
  }

  function previewHtml() {
    const filled = body
      .replace(/\{\{respondent_name\}\}/g, 'Jane Smith')
      .replace(/\{\{form_name\}\}/g, 'Program Impact Survey')
      .replace(/\{\{program_name\}\}/g, 'NTAE Extension Program')
      .replace(/\{\{form_link\}\}/g, '#')
      .replace(/\{\{expiry_date\}\}/g, 'December 31, 2026')
      .replace(/\{\{submitted_at\}\}/g, 'January 15, 2026 at 2:34 PM')
      .replace(/\{\{review_link\}\}/g, '#')

    const filledSubject = subject
      .replace(/\{\{form_name\}\}/g, 'Program Impact Survey')
      .replace(/\{\{program_name\}\}/g, 'NTAE Extension Program')

    return WRAPPER(filled, filledSubject)
  }

  async function sendTest() {
    if (!testEmail.trim()) { toast.error('Enter a recipient email'); return }
    setSending(true)
    const textVersion = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const res = await fetch('/api/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: testEmail.trim(),
        subject,
        html: previewHtml(),
        text: textVersion,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      toast.success(data.sent ? `Test email sent to ${testEmail}` : 'Logged to console (Mailgun not configured)')
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(typeof err.error === 'string' ? err.error : 'Failed to send test email')
    }
    setSending(false)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: template list */}
      <div className="w-[240px] flex-shrink-0 border-r bg-white overflow-y-auto">
        <div className="px-4 py-4 border-b">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Mail className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
            <h1 className="text-[13px] font-semibold text-gray-800">Email Templates</h1>
          </div>
          <p className="text-[11px] text-gray-400">Customize transactional emails sent by the platform.</p>
        </div>
        <nav className="p-2" role="list">
          {TEMPLATES.map(t => (
            <button
              key={t.key}
              role="listitem"
              onClick={() => selectTemplate(t)}
              className={cn(
                'w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-colors',
                selected.key === t.key
                  ? 'bg-orange-50 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
              aria-pressed={selected.key === t.key}
            >
              <p className="text-[12px] font-medium">{t.name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>
            </button>
          ))}
        </nav>
      </div>

      {/* Right: editor + preview */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b bg-white">
          <div>
            <h2 className="text-[14px] font-semibold text-gray-800">{selected.name}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{selected.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('edit')}
              className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors', mode === 'edit' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600')}
              aria-pressed={mode === 'edit'}
            >
              <Code2 className="h-3 w-3" aria-hidden="true" /> Edit
            </button>
            <button
              onClick={() => setMode('preview')}
              className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors', mode === 'preview' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600')}
              aria-pressed={mode === 'preview'}
            >
              <Eye className="h-3 w-3" aria-hidden="true" /> Preview
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#f7f7f8]">
          {mode === 'edit' ? (
            <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
              {/* Variables reference */}
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                <p className="text-[11px] font-medium text-amber-700 mb-1.5">Available variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.variables.map(v => (
                    <code key={v} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800 font-mono">{v}</code>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="email-subject" className="text-[12px] font-medium text-gray-600 block mb-1.5">Subject line</label>
                <Input
                  id="email-subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="h-9 text-[13px] bg-white"
                  placeholder="Email subject"
                />
              </div>

              {/* Body */}
              <div>
                <label htmlFor="email-body" className="text-[12px] font-medium text-gray-600 block mb-1.5">
                  Body <span className="text-gray-400 font-normal">(HTML)</span>
                </label>
                <textarea
                  id="email-body"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={16}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  aria-label="Email body HTML"
                  spellCheck={false}
                />
              </div>

              <p className="text-[11px] text-gray-400">
                Note: templates shown here are for reference. To persist custom templates, connect a database-backed template table in a future release.
              </p>
            </div>
          ) : (
            <div className="p-6">
              <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <div className="px-4 py-2 bg-gray-50 border-b text-[11px] text-gray-400 flex gap-3">
                  <span>To: <span className="text-gray-600">respondent@example.com</span></span>
                  <span>Subject: <span className="text-gray-600">{subject.replace(/\{\{form_name\}\}/g, 'Program Impact Survey')}</span></span>
                </div>
                <iframe
                  srcDoc={previewHtml()}
                  title="Email preview"
                  className="w-full border-0"
                  style={{ height: '500px' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer: test send */}
        <div className="border-t bg-white px-6 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" aria-hidden="true" />
          <p className="text-[12px] text-gray-400 flex-shrink-0">Send test to:</p>
          <Input
            type="email"
            placeholder="your@email.com"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            className="h-8 text-[12px] max-w-xs"
            aria-label="Test recipient email"
          />
          <Button
            onClick={sendTest}
            disabled={sending}
            className="h-8 gap-1.5 text-[12px] bg-orange-600 hover:bg-orange-700 flex-shrink-0"
            aria-busy={sending}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {sending ? 'Sending…' : 'Send test'}
          </Button>
        </div>
      </div>
    </div>
  )
}
