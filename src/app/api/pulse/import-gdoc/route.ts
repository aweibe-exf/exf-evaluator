import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { JWT } from 'google-auth-library'

const schema = z.object({
  url: z.string().url(),
})

/** Extract Google Doc ID from any standard Google Docs URL */
function extractDocId(url: string): string | null {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  return match?.[1] ?? null
}

/** Recursively extract plain text from a Google Doc body content array */
function extractText(content: unknown[]): string {
  const lines: string[] = []
  for (const block of content) {
    const b = block as Record<string, unknown>
    if (b.paragraph) {
      const para = b.paragraph as Record<string, unknown>
      const elements = (para.elements ?? []) as Record<string, unknown>[]
      const line = elements
        .map(el => {
          const tr = el.textRun as Record<string, unknown> | undefined
          return (tr?.content as string) ?? ''
        })
        .join('')
      if (line.trim()) lines.push(line)
    } else if (b.table) {
      const table = b.table as Record<string, unknown>
      const rows = (table.tableRows ?? []) as Record<string, unknown>[]
      for (const row of rows) {
        const cells = (row.tableCells ?? []) as Record<string, unknown>[]
        const rowText = cells.map(cell => {
          const cellContent = (cell.content ?? []) as unknown[]
          return extractText(cellContent).trim()
        }).join(' | ')
        if (rowText) lines.push(rowText)
      }
    }
  }
  return lines.join('\n')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })

  const docId = extractDocId(parsed.data.url)
  if (!docId) {
    return NextResponse.json({ error: 'Could not find a Google Doc ID in that URL. Make sure you paste the full Google Docs link.' }, { status: 422 })
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    return NextResponse.json({
      error: 'Google Docs integration is not configured yet. Add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY to your environment variables.',
    }, { status: 503 })
  }

  try {
    // Authenticate with service account JWT
    const auth = new JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/documents.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
    })
    const token = await auth.getAccessToken()

    // Fetch the document via Google Docs REST API
    const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
      headers: { Authorization: `Bearer ${token.token}` },
    })

    if (!res.ok) {
      if (res.status === 403 || res.status === 404) {
        return NextResponse.json({
          error: `Cannot access this document. Make sure you've shared it with ${email} (viewer access is enough).`,
        }, { status: 403 })
      }
      const detail = await res.text()
      throw new Error(`Google API error ${res.status}: ${detail}`)
    }

    const doc = await res.json() as { title?: string; body?: { content?: unknown[] } }
    const content = extractText(doc.body?.content ?? [])

    if (!content.trim()) {
      return NextResponse.json({ error: 'The document appears to be empty.' }, { status: 422 })
    }

    return NextResponse.json({ title: doc.title ?? 'Untitled document', content })
  } catch (err) {
    console.error('Google Docs import error:', err)
    return NextResponse.json({ error: 'Failed to read the document. Check that you have shared it with the service account.' }, { status: 500 })
  }
}
