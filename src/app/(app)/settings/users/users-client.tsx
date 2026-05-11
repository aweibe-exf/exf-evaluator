'use client'

import { useCallback, useEffect, useState } from 'react'
import { useProgram } from '@/contexts/program-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, UserCircle2, MoreHorizontal, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type UserRole = 'super_admin' | 'program_admin' | 'staff' | 'viewer'

interface Member {
  id: string
  user_id: string
  role: UserRole
  email: string
  created_at: string
}

const ROLE_CONFIG: Record<UserRole, { label: string; className: string; description: string }> = {
  super_admin:   { label: 'Super Admin', className: 'bg-purple-50 text-purple-700 border-purple-100', description: '— Full platform access, manages all programs' },
  program_admin: { label: 'Admin',       className: 'bg-orange-50 text-orange-700 border-orange-100', description: '— Full access, can manage members' },
  staff:         { label: 'Staff',       className: 'bg-blue-50 text-blue-700 border-blue-100',       description: '— Can view & manage submissions' },
  viewer:        { label: 'Viewer',      className: 'bg-gray-50 text-gray-500 border-gray-100',        description: '— Read-only access' },
}

const ROLES: UserRole[] = ['super_admin', 'program_admin', 'staff', 'viewer']

export function UsersClient() {
  const { currentProgram, currentRole } = useProgram()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('program_admin')
  const [submitting, setSubmitting] = useState(false)

  const canManage = currentRole && ['super_admin', 'program_admin'].includes(currentRole)

  const fetchMembers = useCallback(async () => {
    if (!currentProgram) return
    setLoading(true)
    const res = await fetch(`/api/users?program_id=${currentProgram.id}`)
    if (res.ok) setMembers(await res.json())
    setLoading(false)
  }, [currentProgram])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!currentProgram || !email.trim()) return
    setSubmitting(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_id: currentProgram.id, email: email.trim(), role }),
    })
    if (res.ok) {
      const member = await res.json()
      setMembers(m => [...m.filter(x => x.user_id !== member.user_id), member])
      setInviting(false)
      setEmail('')
      toast.success(`Invited ${member.email}`)
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(typeof err.error === 'string' ? err.error : 'Failed to invite user')
    }
    setSubmitting(false)
  }

  async function changeRole(memberId: string, newRole: UserRole) {
    const res = await fetch(`/api/users/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setMembers(m => m.map(x => x.id === memberId ? { ...x, role: newRole } : x))
      toast.success('Role updated')
    } else {
      toast.error('Failed to update role')
    }
  }

  async function removeMember(memberId: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from ${currentProgram?.name}?`)) return
    const res = await fetch(`/api/users/${memberId}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers(m => m.filter(x => x.id !== memberId))
      toast.success('Member removed')
    } else {
      toast.error('Failed to remove member')
    }
  }

  function initials(email: string) {
    const parts = email.split('@')[0].split(/[._-]/)
    const abbr = parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
    return abbr || (email[0]?.toUpperCase() ?? '?')
  }

  return (
    <div className="max-w-3xl px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Users & Roles</h1>
          <p className="mt-0.5 text-[14px] text-gray-500">
            {members.length} member{members.length !== 1 ? 's' : ''} in {currentProgram?.name}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setInviting(true)} className="bg-orange-600 hover:bg-orange-700 h-9 gap-1.5 text-[13px]">
            <Plus className="h-4 w-4" aria-hidden="true" /> Invite member
          </Button>
        )}
      </div>

      {/* Role legend */}
      <div className="flex gap-3 mb-5">
        {ROLES.map(r => {
          const cfg = ROLE_CONFIG[r]
          return (
            <div key={r} className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-gray-400" aria-hidden="true" />
              <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', cfg.className)}>{cfg.label}</span>
            </div>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <UserCircle2 className="mx-auto h-8 w-8 text-gray-200 mb-3" aria-hidden="true" />
          <p className="text-[14px] font-medium text-gray-500">No members yet</p>
          {canManage && (
            <Button variant="ghost" size="sm" className="mt-2 text-orange-600 hover:text-orange-700" onClick={() => setInviting(true)}>
              Invite the first member
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden" role="list">
          {members.map((member, i) => {
            const cfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.viewer
            return (
              <div
                key={member.id}
                role="listitem"
                className={cn('flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group', i < members.length - 1 && 'border-b border-gray-50')}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-semibold text-orange-700" aria-hidden="true">
                  {initials(member.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 truncate">{member.email}</p>
                </div>
                <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium flex-shrink-0', cfg.className)}>{cfg.label}</span>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                      aria-label={`Actions for ${member.email}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {ROLES.filter(r => r !== member.role).map(r => (
                        <DropdownMenuItem key={r} onClick={() => changeRole(member.id, r)}>
                          Change to {ROLE_CONFIG[r].label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => removeMember(member.id, member.email)}
                        className="text-red-500 focus:text-red-500"
                      >
                        Remove member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={inviting} onOpenChange={setInviting}>
        <DialogContent className="sm:max-w-md" aria-describedby="invite-desc">
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <p id="invite-desc" className="text-[13px] text-muted-foreground mt-1">
              They&apos;ll receive a magic-link email to join {currentProgram?.name}.
            </p>
          </DialogHeader>
          <form onSubmit={handleInvite} id="invite-form" className="py-2 space-y-4">
            <div>
              <label htmlFor="invite-email" className="text-[13px] font-medium text-gray-700 block mb-1.5">
                Email <span aria-hidden="true" className="text-red-500">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="h-9 text-[13px]"
                aria-required="true"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-gray-700 block mb-1.5">Role</label>
              <div className="space-y-2">
                {ROLES.map(r => {
                  const cfg = ROLE_CONFIG[r]
                  return (
                    <label key={r} className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="mt-0.5 h-3.5 w-3.5 text-orange-600 border-gray-300 focus:ring-orange-500"
                      />
                      <span>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', cfg.className)}>{cfg.label}</span>
                        <span className="ml-2 text-[12px] text-gray-500">{ROLE_CONFIG[r].description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviting(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" form="invite-form" className="bg-orange-600 hover:bg-orange-700" disabled={submitting || !email.trim()} aria-busy={submitting}>
              {submitting ? 'Inviting…' : 'Send invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
