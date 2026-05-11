'use client'

import { useEffect, useState, useCallback } from 'react'
import { useProgram } from '@/contexts/program-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Sparkles, TrendingUp, Users, FileText, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { subDays, format } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { FormSettings } from '@/types/forms'

interface SubmissionRow {
  id: string
  submitted_at: string | null
  forms: { name: string; settings: FormSettings } | null
}

interface ChartPoint { date: string; count: number }
interface FormCount { name: string; count: number }
interface PeriodCount { period: string; count: number; dateRange?: string }

const SUMMARY_TYPES = [
  { key: 'key_themes',    label: 'Key Themes' },
  { key: 'trend',         label: 'Trend Analysis' },
  { key: 'impact_story',  label: 'Impact Story' },
  { key: 'logic_model',   label: 'Logic Model' },
] as const

type SummaryType = typeof SUMMARY_TYPES[number]['key']

function periodLabel(value: string): string {
  // For months (YYYY-MM), format nicely; otherwise use as-is (custom quarter labels)
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  return value
}

export function ImpactClient() {
  const { currentProgram } = useProgram()
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [summaryType, setSummaryType] = useState<SummaryType>('key_themes')
  const [summaryContent, setSummaryContent] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 90), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [periodView, setPeriodView] = useState<'daily' | 'period'>('daily')

  const fetchData = useCallback(async () => {
    if (!currentProgram) return
    setLoading(true)
    const res = await fetch(`/api/submissions?program_id=${currentProgram.id}`)
    if (res.ok) setSubmissions(await res.json())
    setLoading(false)
  }, [currentProgram])

  useEffect(() => { fetchData() }, [fetchData])

  // Daily submission trend (last 30 days)
  const trendData: ChartPoint[] = (() => {
    const counts: Record<string, number> = {}
    submissions.forEach(s => {
      if (!s.submitted_at) return
      const day = s.submitted_at.slice(0, 10)
      counts[day] = (counts[day] ?? 0) + 1
    })
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, count]) => ({ date: format(new Date(date + 'T00:00:00'), 'MMM d'), count }))
  })()

  // Period-grouped data — sorted by periodStart date if available, else label
  const periodData: PeriodCount[] = (() => {
    const map = new Map<string, { count: number; start?: string; end?: string }>()
    submissions.forEach(s => {
      const ps = s.forms?.settings as FormSettings | undefined
      const pv = ps?.periodValue
      if (!pv) return
      const existing = map.get(pv) ?? { count: 0, start: ps?.periodStart, end: ps?.periodEnd }
      map.set(pv, { ...existing, count: existing.count + 1 })
    })
    return [...map.entries()]
      .sort(([, a], [, b]) => {
        if (a.start && b.start) return a.start.localeCompare(b.start)
        return 0
      })
      .map(([period, { count, start, end }]) => ({
        period: periodLabel(period),
        count,
        dateRange: start && end ? `${start} – ${end}` : undefined,
      }))
  })()

  const hasPeriodData = periodData.length > 0

  // Submissions per form
  const formCounts: FormCount[] = (() => {
    const counts: Record<string, number> = {}
    submissions.forEach(s => {
      const name = s.forms?.name ?? 'Unknown'
      counts[name] = (counts[name] ?? 0) + 1
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 22 ? name.slice(0, 20) + '…' : name, count }))
  })()

  const submitted = submissions.filter(s => s.submitted_at)
  const recent = submissions.filter(s => s.submitted_at && new Date(s.submitted_at) > subDays(new Date(), 30))

  async function generateSummary() {
    if (!currentProgram) return
    setGenerating(true)
    setSummaryContent(null)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: currentProgram.id,
          date_from: dateFrom,
          date_to: dateTo,
          summary_type: summaryType,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSummaryContent(data.content)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to generate summary')
      }
    } catch {
      toast.error('Failed to connect to AI service')
    }
    setGenerating(false)
  }

  const brandColor = currentProgram?.brand_color ?? '#ea580c'

  return (
    <div className="max-w-5xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Impact Dashboard</h1>
        <p className="mt-0.5 text-[14px] text-gray-500">{currentProgram?.name}</p>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total responses', value: submitted.length, icon: Users, color: 'text-blue-600 bg-blue-50' },
            { label: 'Last 30 days', value: recent.length, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Active forms', value: formCounts.length, icon: FileText, color: 'text-orange-600 bg-orange-50' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${card.color}`}>
                <card.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[28px] font-bold text-gray-900 leading-none">{card.value.toLocaleString()}</p>
                <p className="text-[12px] text-gray-500 mt-0.5">{card.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Trend — toggle daily / by period */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-gray-600 uppercase tracking-wider">
              {periodView === 'period' ? 'Responses by period' : 'Submissions — last 30 days'}
            </h2>
            {hasPeriodData && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label="Chart view">
                {(['daily', 'period'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setPeriodView(v)}
                    className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${periodView === v ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}
                    aria-pressed={periodView === v}
                  >
                    {v === 'daily' ? 'Daily' : 'Period'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {loading ? <Skeleton className="h-48" /> : (
            periodView === 'period' && hasPeriodData ? (
              periodData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-[13px] text-gray-400">No period data</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={periodData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} width={24} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={(value, _name, props) => {
                        const dr = (props.payload as PeriodCount).dateRange
                        return [value, dr ? `Responses (${dr})` : 'Responses']
                      }}
                    />
                    <Bar dataKey="count" fill={brandColor} radius={[4, 4, 0, 0]} name="Responses" />
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : trendData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-[13px] text-gray-400">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} width={24} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Line type="monotone" dataKey="count" stroke={brandColor} strokeWidth={2} dot={false} name="Responses" />
                </LineChart>
              </ResponsiveContainer>
            )
          )}
          {!hasPeriodData && !loading && (
            <p className="text-[11px] text-gray-300 mt-2 text-center">Assign periods to forms in Form Settings to enable period view</p>
          )}
        </div>

        {/* By form */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-[13px] font-semibold text-gray-600 uppercase tracking-wider mb-4">Responses by form</h2>
          {loading ? <Skeleton className="h-48" /> : formCounts.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-[13px] text-gray-400">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={formCounts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="count" fill={brandColor} radius={[0, 4, 4, 0]} name="Responses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-[13px] font-semibold text-gray-600 uppercase tracking-wider">AI Summary</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 rounded-md px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400" aria-label="Start date" />
              <span>–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 rounded-md px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400" aria-label="End date" />
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label="Summary type">
              {SUMMARY_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setSummaryType(t.key)}
                  className={`px-2.5 py-1 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${summaryType === t.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                  aria-pressed={summaryType === t.key}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={generateSummary}
              disabled={generating || submitted.length === 0}
              aria-busy={generating}
              className="gap-1.5 text-[12px] h-8"
              style={{ backgroundColor: brandColor }}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>

        {generating ? (
          <div className="space-y-2 py-2" aria-live="polite">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className={`h-4 rounded ${i === 4 ? 'w-2/3' : 'w-full'}`} />)}
          </div>
        ) : summaryContent ? (
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap text-[14px]" aria-live="polite">
            {summaryContent}
          </div>
        ) : (
          <div className="py-8 text-center text-[13px] text-gray-400">
            {submitted.length === 0
              ? 'No submitted responses yet. Collect some data first.'
              : 'Select a date range and summary type, then click Generate.'}
          </div>
        )}
      </div>
    </div>
  )
}
