'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Send, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface Props {
  formId: string
  formName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteDialog({ formId, formName, open, onOpenChange }: Props) {
  const [emails, setEmails] = useState([''])
  const [sending, setSending] = useState(false)

  function addEmail() {
    setEmails(prev => [...prev, ''])
  }

  function updateEmail(index: number, value: string) {
    setEmails(prev => prev.map((e, i) => i === index ? value : e))
  }

  function removeEmail(index: number) {
    setEmails(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSend() {
    const valid = emails.filter(e => e.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()))
    if (valid.length === 0) {
      toast.error('Enter at least one valid email address')
      return
    }

    setSending(true)
    let sent = 0
    let failed = 0

    await Promise.allSettled(
      valid.map(async (email) => {
        const res = await fetch('/api/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form_id: formId, email: email.trim() }),
        })
        if (res.ok) sent++
        else failed++
      })
    )

    setSending(false)
    if (sent > 0) toast.success(`Invitation${sent > 1 ? 's' : ''} sent to ${sent} recipient${sent > 1 ? 's' : ''}`)
    if (failed > 0) toast.error(`${failed} invitation${failed > 1 ? 's' : ''} failed to send`)
    if (sent > 0) {
      setEmails([''])
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="invite-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-orange-500" aria-hidden="true" />
            Invite respondents
          </DialogTitle>
          <p id="invite-desc" className="text-[13px] text-muted-foreground mt-1">
            Each person receives a unique, personal link to <strong>{formName}</strong>.
          </p>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {emails.map((email, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="email"
                value={email}
                onChange={e => updateEmail(i, e.target.value)}
                placeholder="respondent@example.com"
                className="h-9 text-[13px] flex-1"
                aria-label={`Email address ${i + 1}`}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
              />
              {emails.length > 1 && (
                <button
                  onClick={() => removeEmail(i)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  aria-label={`Remove email ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addEmail}
            className="flex items-center gap-1.5 text-[12px] text-orange-600 hover:text-orange-700 transition-colors focus:outline-none focus-visible:underline mt-1"
            aria-label="Add another email"
          >
            <Plus className="h-3 w-3" aria-hidden="true" /> Add another
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || emails.every(e => !e.trim())}
            aria-busy={sending}
            className="bg-orange-600 hover:bg-orange-700 gap-1.5"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {sending ? 'Sending…' : 'Send invitations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
