'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { FileText, LogOut, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'

interface MySubmission {
  id: string
  status: string
  submitted_at: string | null
  form_id: string
  forms: {
    name: string
    slug: string
    programs: { name: string } | null
  } | null
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  submitted: { label: 'Submitted', icon: CheckCircle2, className: 'text-emerald-600' },
  reviewed:  { label: 'Reviewed',  icon: CheckCircle2, className: 'text-blue-600' },
  draft:     { label: 'Draft',     icon: Clock,        className: 'text-gray-400' },
}

export function RespondentPortal({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<MySubmission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/my/submissions')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setSubmissions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const initials = userEmail.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-[11px] font-semibold text-orange-700" aria-hidden="true">
            {initials}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-800">My Submissions</p>
            <p className="text-[11px] text-gray-400">{userEmail}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-[12px] text-gray-500" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out
        </Button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <p className="text-[14px] text-gray-500 mb-6">
          All forms you&apos;ve submitted are listed below. Click any row to view your response.
        </p>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : submissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
            <FileText className="mx-auto h-8 w-8 text-gray-200 mb-3" aria-hidden="true" />
            <p className="text-[14px] font-medium text-gray-500">No submissions yet</p>
            <p className="text-[12px] text-gray-400 mt-1">When you complete a form, it will appear here.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden" role="list">
            {submissions.map((sub, i) => {
              const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.submitted
              const Icon = cfg.icon
              return (
                <div
                  key={sub.id}
                  role="listitem"
                  className={cn(
                    'flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer group',
                    i < submissions.length - 1 && 'border-b border-gray-50'
                  )}
                  onClick={() => router.push(`/my/submissions/${sub.id}`)}
                  onKeyDown={e => e.key === 'Enter' && router.push(`/my/submissions/${sub.id}`)}
                  tabIndex={0}
                  aria-label={`View submission for ${sub.forms?.name ?? 'form'}`}
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50">
                    <FileText className="h-4 w-4 text-orange-500" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{sub.forms?.name ?? 'Form'}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {sub.forms?.programs?.name ?? ''}{sub.submitted_at ? ` · ${format(new Date(sub.submitted_at), 'MMM d, yyyy')}` : ''}
                    </p>
                  </div>
                  <div className={cn('flex items-center gap-1 text-[11px] font-medium flex-shrink-0', cfg.className)}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {cfg.label}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                </div>
              )
            })}
          </div>
        )}

        {submissions.length > 0 && (
          <p className="text-[11px] text-gray-400 text-center mt-4">
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''} · {formatDistanceToNow(new Date(submissions[0].submitted_at ?? new Date()), { addSuffix: true })} most recently
          </p>
        )}
      </main>
    </div>
  )
}
