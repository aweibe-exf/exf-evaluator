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
import { Plus, UserCircle2, MoreHorizontal, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type UserRole = 'super_admin' | 'program_admin' | 'staff' | 'viewer'
type AddMode = 'invite' | 'password'

interface Member {
  id: string
  user_id: string
  role: UserRole
  email: string
  created_at: string
  email_confirmed: boolean
  last_sign_in: string | null
}

const ROLE_CONFIG: Record<UserRole, { label: string; className: string; description: string }> = {
  super_admin:   { label: 'Super Admin', className: 'bg-purple-50 text-purple-700 border-purple-100', description: '— Full platform access, manages all programs' },
  program_admin: { label: 'Admin',       className: 'bg-orange-50 text-orange-700 border-orange-100', description: '— Full access, can manage members' },
  staff:         { label: 'Staff',       className: 'bg-blue-50 text-blue-700 border-blue-100',       description: '— Can view & manage submissions' },
  viewer:        { label: 'Viewer',      className: 'bg-gray-50 text-gray-500 border-gray-100',        description: '— Read-only access' },
}

const ROLES: UserRole[] = ['super_admin', 'program_admin', 'staff', 'viewer']

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length])
    .join('')
}

export function UsersClient() {
  const { currentProgram, currentRole } = useProgram()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addMode, setAddMode] = useState<AddMode>('invite')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('staff')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Per-member action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canManage = currentRole && ['super_admin', 'program_admin'].includes(currentRole)

  const fetchMembers = useCallback(async () => {
    if (!currentProgram) return
    setLoading(true)
    const res = await fetch(`/api/users?program_id=${currentProgram.id}`)
    if (res.ok) setMembers(await res.json())
    setLoading(false)
  }, [currentProgram])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  function openDialog() {
    setEmail('')
    setRole('staff')
    setPassword('')
    setShowPassword(false)
    setAddMode('invite')
    setDialogOpen(true)
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!currentProgram || !email.trim()) return
    if (addMode === 'password' && password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSubmitting(true)
    const body: Record<string, unknown> = {
      program_id: currentProgram.id,
      email: email.trim(),
      role,
      mode: addMode,
    }
    if (addMode === 'password') body.password = password

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const member = await res.json()
      setMembers(m => [...m.filter(x => x.user_id !== member.user_id), { ...member, email_confirmed: addMode === 'password', last_sign_in: null }])
      setDialogOpen(false)
      toast.success(addMode === 'password'
        ? `Account created for ${String(member.email)} — welcome email sent`
        : `Invite sent to ${String(member.email)}`)
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(typeof err.error === 'string' ? err.error : 'Failed to add member')
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

  async function sendAction(memberId: string, memberEmail: string, action: 'resend_invite' | 'send_reset') {
    setActionLoading(memberId + action)
    const res = await fetch(`/api/users/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setActionLoading(null)
    if (res.ok) {
      toast.success(action === 'send_reset'
        ? `Password reset link sent to ${memberEmail}`
        : `Invite resent to ${memberEmail}`)
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(typeof err.error === 'string' ? err.error : 'Action failed')
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

  function initials(em: string) {
    const parts = em.split('@')[0].split(/[._-]/)
    const abbr = parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
    return abbr || (em[0]?.toUpperCase() ?? '?')
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
          <Button onClick={openDialog} className="bg-orange-600 hover:bg-orange-700 h-9 gap-1.5 text-[13px]">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add member
          </Button>
        )}
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3 mb-5">
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
            <Button variant="ghost" size="sm" className="mt-2 text-orange-600 hover:text-orange-700" onClick={openDialog}>
              Add the first member
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden" role="list">
          {members.map((member, i) => {
            const cfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.viewer
            const isPending = !member.email_confirmed
            return (
              <div
                key={member.id}
                role="listitem"
                className={cn(
                  'flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group',
                  i < members.length - 1 && 'border-b border-gray-50'
                )}
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-semibold text-orange-700"
                  aria-hidden="true"
                >
                  {initials(member.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 truncate">{member.email}</p>
                  {isPending ? (
                    <p className="text-[11px] text-amber-500 mt-0.5">Invite pending — hasn't signed in yet</p>
                  ) : member.last_sign_in ? (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Last sign-in {new Date(member.last_sign_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400 mt-0.5">Never signed in</p>
                  )}
                </div>
                <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium flex-shrink-0', cfg.className)}>
                  {cfg.label}
                </span>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                      aria-label={`Actions for ${member.email}`}
                      disabled={actionLoading?.startsWith(member.id)}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {/* Role changes */}
                      {ROLES.filter(r => r !== member.role).map(r => (
                        <DropdownMenuItem key={r} onClick={() => changeRole(member.id, r)}>
                          Change to {ROLE_CONFIG[r].label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      {/* Email actions */}
                      {isPending ? (
                        <DropdownMenuItem onClick={() => sendAction(member.id, member.email, 'resend_invite')}>
                          Resend invite email
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => sendAction(member.id, member.email, 'send_reset')}>
                          Send password reset
                        </DropdownMenuItem>
                      )}
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

      {/* Add member dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby="add-member-desc">
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <p id="add-member-desc" className="text-[13px] text-muted-foreground mt-1">
              Add someone to {currentProgram?.name}.
            </p>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-2" role="group" aria-label="Add method">
            {([['invite', 'Send invite link'], ['password', 'Set password']] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setAddMode(m)}
                className={cn(
                  'flex-1 py-2 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
                  addMode === m ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                )}
                aria-pressed={addMode === m}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-gray-400 mb-3 -mt-1">
            {addMode === 'invite'
              ? 'We\'ll email them a magic link to create their account.'
              : 'Create the account now and email them their temporary password.'}
          </p>

          <form onSubmit={handleAddMember} id="add-member-form" className="space-y-4">
            <div>
              <label htmlFor="add-email" className="text-[13px] font-medium text-gray-700 block mb-1.5">
                Email <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <Input
                id="add-email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="h-9 text-[13px]"
              />
            </div>

            {addMode === 'password' && (
              <div>
                <label htmlFor="add-password" className="text-[13px] font-medium text-gray-700 block mb-1.5">
                  Temporary password <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="add-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="h-9 text-[13px] pr-9"
                      minLength={8}
                      required={addMode === 'password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-[12px] px-3 flex-shrink-0"
                    onClick={() => { const p = generatePassword(); setPassword(p); setShowPassword(true) }}
                  >
                    Generate
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">This will be included in the welcome email sent to them.</p>
              </div>
            )}

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
                        <span className="ml-2 text-[12px] text-gray-500">{cfg.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </form>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button
              type="submit"
              form="add-member-form"
              className="bg-orange-600 hover:bg-orange-700"
              disabled={submitting || !email.trim() || (addMode === 'password' && password.length < 8)}
              aria-busy={submitting}
            >
              {submitting ? 'Adding…' : addMode === 'invite' ? 'Send invite' : 'Create account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
