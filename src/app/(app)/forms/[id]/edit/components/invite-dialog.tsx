'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Send, X, Plus, Trash2, Users, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useProgram } from '@/contexts/program-context'
import { cn } from '@/lib/utils'

interface RespondentGroup {
  id: string
  name: string
  emails: string[]
}

interface Props {
  formId: string
  formName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Tab = 'individual' | 'group'

export function InviteDialog({ formId, formName, open, onOpenChange }: Props) {
  const { currentProgram } = useProgram()
  const [tab, setTab] = useState<Tab>('individual')

  // Individual tab
  const [emails, setEmails] = useState([''])
  const [sending, setSending] = useState(false)

  // Group tab
  const [groups, setGroups] = useState<RespondentGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [groupOpen, setGroupOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab('individual')
    setEmails([''])
    setSelectedGroupId('')
  }, [open])

  useEffect(() => {
    if (!open || !currentProgram) return
    setGroupsLoading(true)
    fetch(`/api/respondent-groups?program_id=${currentProgram.id}`)
      .then(r => r.json())
      .then(data => setGroups(Array.isArray(data) ? data : []))
      .finally(() => setGroupsLoading(false))
  }, [open, currentProgram])

  function addEmail() { setEmails(prev => [...prev, '']) }
  function updateEmail(i: number, v: string) { setEmails(prev => prev.map((e, j) => j === i ? v : e)) }
  function removeEmail(i: number) { setEmails(prev => prev.filter((_, j) => j !== i)) }

  async function sendInvites(emailList: string[]) {
    const valid = emailList.filter(e => e.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()))
    if (valid.length === 0) { toast.error('No valid email addresses to send to'); return }

    setSending(true)
    let sent = 0, failed = 0
    await Promise.allSettled(
      valid.map(async email => {
        const res = await fetch('/api/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form_id: formId, email: email.trim().toLowerCase() }),
        })
        if (res.ok) sent++; else failed++
      })
    )
    setSending(false)
    if (sent > 0) toast.success(`Invitation${sent > 1 ? 's' : ''} sent to ${sent} recipient${sent > 1 ? 's' : ''}`)
    if (failed > 0) toast.error(`${failed} invitation${failed > 1 ? 's' : ''} failed to send`)
    if (sent > 0) { setEmails(['']); setSelectedGroupId(''); onOpenChange(false) }
  }

  async function handleSend() {
    if (tab === 'individual') {
      await sendInvites(emails)
    } else {
      const group = groups.find(g => g.id === selectedGroupId)
      if (!group) { toast.error('Select a group first'); return }
      await sendInvites(group.emails)
    }
  }

  const selectedGroup = groups.find(g => g.id === selectedGroupId)
  const canSend = tab === 'individual'
    ? emails.some(e => e.trim())
    : !!selectedGroupId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="invite-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-orange-500" />
            Invite respondents
          </DialogTitle>
          <p id="invite-desc" className="text-[13px] text-muted-foreground mt-1">
            Each person receives a unique, personal link to <strong>{formName}</strong>.
          </p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 gap-0.5">
          {([['individual', 'Enter emails', Send], ['group', 'Use a group', Users]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                tab === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Individual tab */}
        {tab === 'individual' && (
          <div className="space-y-2">
            {emails.map((email, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={e => updateEmail(i, e.target.value)}
                  placeholder="respondent@example.com"
                  className="h-9 text-[13px] flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
                />
                {emails.length > 1 && (
                  <button onClick={() => removeEmail(i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addEmail}
              className="flex items-center gap-1.5 text-[12px] text-orange-600 hover:text-orange-700 mt-1"
            >
              <Plus className="h-3 w-3" /> Add another
            </button>
          </div>
        )}

        {/* Group tab */}
        {tab === 'group' && (
          <div className="space-y-3">
            {groupsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
                <Users className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-zinc-500">No respondent groups yet</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Create groups in <strong>Settings → Respondent Groups</strong>.
                </p>
              </div>
            ) : (
              <>
                {/* Custom dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setGroupOpen(v => !v)}
                    className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-left hover:border-zinc-300 transition-colors"
                  >
                    <span className={selectedGroup ? 'text-zinc-900' : 'text-zinc-400'}>
                      {selectedGroup ? selectedGroup.name : 'Select a group…'}
                    </span>
                    <ChevronDown className={cn('h-4 w-4 text-zinc-400 transition-transform', groupOpen && 'rotate-180')} />
                  </button>
                  {groupOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
                      {groups.map(g => (
                        <button
                          key={g.id}
                          className="flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-zinc-50 transition-colors"
                          onClick={() => { setSelectedGroupId(g.id); setGroupOpen(false) }}
                        >
                          <span className="font-medium text-zinc-900">{g.name}</span>
                          <span className="text-xs text-zinc-400">{g.emails.length} recipients</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedGroup && (
                  <div className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2.5">
                    <p className="text-xs font-medium text-orange-800 mb-1">
                      {selectedGroup.emails.length} invitations will be sent:
                    </p>
                    <p className="text-[11px] text-orange-700 leading-relaxed">
                      {selectedGroup.emails.slice(0, 6).join(', ')}
                      {selectedGroup.emails.length > 6 && ` +${selectedGroup.emails.length - 6} more`}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !canSend}
            className="bg-orange-600 hover:bg-orange-700 gap-1.5"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? 'Sending…' : 'Send invitations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
