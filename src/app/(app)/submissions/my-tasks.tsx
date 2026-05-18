'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, ArrowRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FormSettings } from '@/types/forms'

interface Task {
  id: string
  token: string
  expires_at: string
  forms: {
    id: string
    name: string
    slug: string
    settings: FormSettings | null
    programs: { name: string } | null
  } | null
}

function closeDate(task: Task): Date {
  // Prefer the form's explicit closesAt; fall back to token expires_at
  const closes = task.forms?.settings?.closesAt
  return closes ? new Date(closes + 'T23:59:59') : new Date(task.expires_at)
}

function urgency(date: Date): 'overdue' | 'urgent' | 'soon' | 'ok' {
  const days = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (days < 0)  return 'overdue'
  if (days <= 2) return 'urgent'
  if (days <= 7) return 'soon'
  return 'ok'
}

const urgencyStyle = {
  overdue: { bar: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',    label: 'Overdue' },
  urgent:  { bar: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Due soon' },
  soon:    { bar: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-200',    label: 'Coming up' },
  ok:      { bar: 'bg-emerald-400',badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'On track' },
}

export function MyTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/my-tasks')
      .then(r => r.ok ? r.json() : [])
      .then(setTasks)
      .finally(() => setLoading(false))
  }, [])

  // Don't render anything if loading is done and there are no tasks
  if (!loading && tasks.length === 0) return null

  const appUrl = window.location.origin

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <h2 className="text-[14px] font-semibold text-gray-700">Your to-do</h2>
        {!loading && (
          <span className="ml-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
            {tasks.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map(task => {
            const due = closeDate(task)
            const u = urgency(due)
            const style = urgencyStyle[u]
            const formUrl = `${appUrl}/f/${task.forms?.slug}?token=${task.token}`
            const dueLabel = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

            return (
              <a
                key={task.id}
                href={formUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all overflow-hidden"
                aria-label={`Fill out ${task.forms?.name ?? 'form'} — due ${dueLabel}`}
              >
                {/* Urgency bar on left edge */}
                <div className={cn('absolute left-0 top-0 h-full w-1 rounded-l-xl', style.bar)} aria-hidden="true" />

                <div className="pl-1">
                  <p className="text-[13px] font-semibold text-gray-800 leading-snug mb-1 pr-6">
                    {task.forms?.name ?? 'Form'}
                  </p>
                  {task.forms?.programs?.name && (
                    <p className="text-[11px] text-gray-400 mb-2">{task.forms.programs.name}</p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-gray-400 flex-shrink-0" aria-hidden="true" />
                    <span className="text-[12px] text-gray-500">Due {dueLabel}</span>
                    <span className={cn('ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold', style.badge)}>
                      {style.label}
                    </span>
                  </div>
                </div>

                {/* Arrow hint */}
                <ArrowRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 group-hover:text-orange-500 transition-colors" aria-hidden="true" />
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
