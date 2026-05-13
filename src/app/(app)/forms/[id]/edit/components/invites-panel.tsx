'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Mail, RefreshCw, Trash2, CheckCircle2, Clock, Link2, Copy, Code, BellRing } from 'lucide-react'
import { format, formatDistanceToNow, isPast } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Token = Database['public']['Tables']['submission_tokens']['Row']

const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''

interface Props {
  formId: string
  formSlug: string
}

export function InvitesPanel({ formId, formSlug }: Props) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)
  const [remindingAll, setRemindingAll] = useState(false)

  const fetchTokens = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/tokens?form_id=${formId}`)
    if (res.ok) setTokens(await res.json())
    setLoading(false)
  }, [formId])

  useEffect(() => { fetchTokens() }, [fetchTokens])

  async function revoke(id: string) {
    if (!confirm('Revoke this invitation? The recipient will no longer be able to use their link.')) return
    setActioning(id)
    const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTokens(t => t.filter(x => x.id !== id))
      toast.success('Invitation revoked')
    } else {
      toast.error('Failed to revoke')
    }
    setActioning(null)
  }

  async function resend(id: string, email: string) {
    setActioning(id)
    const res = await fetch(`/api/tokens/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resend' }),
    })
    if (res.ok) {
      toast.success(`Resent to ${email}`)
      await fetchTokens()
    } else {
      toast.error('Failed to resend')
    }
    setActioning(null)
  }

  async function remindAllPending() {
    setRemindingAll(true)
    let count = 0
    for (const tok of pending) {
      const res = await fetch(`/api/tokens/${tok.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend' }),
      })
      if (res.ok) count++
    }
    await fetchTokens()
    setRemindingAll(false)
    toast.success(`Reminders sent to ${count} respondent${count !== 1 ? 's' : ''}`)
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${APP_URL}/f/${formSlug}?token=${token}`)
    toast.success('Link copied')
  }

  const used = tokens.filter(t => t.used_at)
  const pending = tokens.filter(t => !t.used_at && !isPast(new Date(t.expires_at)))
  const expired = tokens.filter(t => !t.used_at && isPast(new Date(t.expires_at)))

  const previewUrl = `${APP_URL}/f/${formSlug}?preview=true`
  const embedCode = `<iframe src="${previewUrl}" width="100%" height="600" frameborder="0" style="border-radius:8px;border:1px solid #e5e7eb;"></iframe>`

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Share link + embed */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Share</p>
        <div>
          <p className="text-[11px] text-gray-500 mb-1 flex items-center gap-1"><Link2 className="h-3 w-3" aria-hidden="true" /> Preview link <span className="text-gray-400">(read-only, no submissions)</span></p>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 truncate rounded bg-white border border-gray-200 px-2 py-1 text-[10px] text-gray-600 font-mono">{previewUrl}</code>
            <button
              onClick={() => copyText(previewUrl, 'Preview link')}
              className="p-1.5 rounded text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-400"
              aria-label="Copy public link"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div>
          <p className="text-[11px] text-gray-500 mb-1 flex items-center gap-1"><Code className="h-3 w-3" aria-hidden="true" /> Embed code</p>
          <div className="flex items-start gap-1.5">
            <code className="flex-1 rounded bg-white border border-gray-200 px-2 py-1 text-[10px] text-gray-600 font-mono break-all leading-relaxed">{embedCode}</code>
            <button
              onClick={() => copyText(embedCode, 'Embed code')}
              className="p-1.5 rounded text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-400 flex-shrink-0 mt-0.5"
              aria-label="Copy embed code"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-[12px] text-gray-500">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" />{used.length} completed</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" aria-hidden="true" />{pending.length} pending</span>
          <span className="text-gray-300">{expired.length} expired</span>
        </div>
        <button
          onClick={fetchTokens}
          className="text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded"
          aria-label="Refresh invitations"
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
        </button>
      </div>
      {pending.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={remindAllPending}
          disabled={remindingAll}
          aria-busy={remindingAll}
          className="w-full h-8 text-[12px] text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 gap-1.5"
        >
          <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
          {remindingAll ? 'Sending reminders…' : 'Remind all pending'}
        </Button>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : tokens.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center">
          <Mail className="mx-auto h-6 w-6 text-gray-200 mb-2" aria-hidden="true" />
          <p className="text-[13px] font-medium text-gray-400">No invitations yet</p>
          <p className="text-[11px] text-gray-300 mt-0.5">Use the Invite button to send form links</p>
        </div>
      ) : (
        <div className="space-y-1.5" role="list">
          {tokens.map(tok => {
            const isUsed = !!tok.used_at
            const isExpired = !isUsed && isPast(new Date(tok.expires_at))
            const isPending = !isUsed && !isExpired
            const isBusy = actioning === tok.id
            const meta = (tok.metadata ?? {}) as Record<string, unknown>
            const reminderCount = typeof meta.reminderCount === 'number' ? meta.reminderCount : 0

            return (
              <div
                key={tok.id}
                role="listitem"
                className={cn(
                  'rounded-lg border px-3 py-2.5 flex items-center gap-3 text-[12px]',
                  isUsed ? 'border-emerald-100 bg-emerald-50/50' : isExpired ? 'border-gray-100 bg-gray-50/50 opacity-60' : 'border-gray-100 bg-white'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate">{tok.email}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isUsed
                      ? `Completed ${formatDistanceToNow(new Date(tok.used_at!), { addSuffix: true })}`
                      : isExpired
                        ? `Expired ${format(new Date(tok.expires_at), 'MMM d')}`
                        : `Sent ${tok.sent_at ? formatDistanceToNow(new Date(tok.sent_at), { addSuffix: true }) : 'not yet'} · expires ${format(new Date(tok.expires_at), 'MMM d')}`
                    }
                  </p>
                  {isPending && reminderCount > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{reminderCount} reminder{reminderCount !== 1 ? 's' : ''} sent</p>
                  )}
                </div>
                {isUsed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" aria-label="Completed" />
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => copyLink(tok.token)}
                      className="p-1 rounded text-gray-300 hover:text-gray-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-400"
                      aria-label="Copy invitation link"
                      disabled={isBusy}
                    >
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    {!isExpired && (
                      <button
                        onClick={() => resend(tok.id, tok.email)}
                        className="p-1 rounded text-gray-300 hover:text-blue-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-400"
                        aria-label="Resend invitation"
                        disabled={isBusy}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', isBusy && 'animate-spin')} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      onClick={() => revoke(tok.id)}
                      className="p-1 rounded text-gray-300 hover:text-red-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-400"
                      aria-label="Revoke invitation"
                      disabled={isBusy}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
