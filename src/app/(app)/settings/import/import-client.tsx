'use client'

import { useCallback, useState } from 'react'
import { useProgram } from '@/contexts/program-context'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type ImportJob = Database['public']['Tables']['import_jobs']['Row']

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending:    { label: 'Pending',    icon: Loader2,        className: 'text-gray-400' },
  processing: { label: 'Processing', icon: Loader2,        className: 'text-blue-500' },
  review:     { label: 'Review',     icon: AlertCircle,    className: 'text-amber-500' },
  complete:   { label: 'Complete',   icon: CheckCircle2,   className: 'text-emerald-500' },
  failed:     { label: 'Failed',     icon: AlertCircle,    className: 'text-red-500' },
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  return lines.slice(1, 11).map(line => {
    const vals = line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

interface MappingEditorProps {
  job: ImportJob
  onSave: (mappings: Record<string, string>) => Promise<void>
  saving: boolean
}

function MappingEditor({ job, onSave, saving }: MappingEditorProps) {
  const schema = (job.detected_schema ?? {}) as Record<string, string>
  const rawMappings = (job.column_mappings ?? {}) as Record<string, string>
  const initialPeriodType = (rawMappings._period_type ?? '') as 'month' | 'quarter' | ''
  const initialPeriodValue = rawMappings._period_value ?? ''
  const initialMappings = Object.fromEntries(Object.entries(rawMappings).filter(([k]) => !k.startsWith('_period_')))

  const [mappings, setMappings] = useState<Record<string, string>>(initialMappings)
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | ''>(initialPeriodType)
  const [periodValue, setPeriodValue] = useState(initialPeriodValue)
  const preview = (job.preview_data ?? []) as Record<string, string>[]

  const FIELD_TYPES = ['text', 'number', 'date', 'email', 'single_choice', 'multiple_choice', 'scale', 'boolean', 'name', 'identifier', 'skip']

  function handleSave() {
    const full: Record<string, string> = { ...mappings }
    if (periodType) { full._period_type = periodType; full._period_value = periodValue }
    onSave(full)
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-gray-800">{job.file_name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{job.row_count?.toLocaleString()} rows · AI detected {Object.keys(schema).length} columns</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-8 text-[12px] bg-orange-600 hover:bg-orange-700 gap-1.5"
          aria-busy={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Confirm & create form'}
        </Button>
      </div>

      {/* Period assignment in editor */}
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-3 flex-wrap">
        <span className="text-[12px] font-medium text-gray-600">Reporting period:</span>
        <select
          value={periodType}
          onChange={e => { setPeriodType(e.target.value as 'month' | 'quarter' | ''); setPeriodValue('') }}
          className="h-7 rounded-md border border-gray-200 px-2 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
          aria-label="Period type"
        >
          <option value="">None</option>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
        </select>
        {periodType && (
          <select
            value={periodValue}
            onChange={e => setPeriodValue(e.target.value)}
            className="h-7 rounded-md border border-gray-200 px-2 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
            aria-label="Period value"
          >
            <option value="">Select period…</option>
            {periodOptions(periodType).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {periodValue && <span className="text-[11px] text-orange-600 font-medium">A form will be created for this period</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-1/3">Column</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-1/4">AI detected type</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-1/4">Map to type</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Sample value</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(schema).map(col => (
              <tr key={col} className="border-b last:border-0 hover:bg-gray-50/50">
                <td className="px-4 py-2.5 text-gray-700 font-medium truncate max-w-[200px]">{col}</td>
                <td className="px-4 py-2.5 text-gray-400">{schema[col]}</td>
                <td className="px-4 py-2.5">
                  <select
                    value={mappings[col] ?? schema[col] ?? 'text'}
                    onChange={e => setMappings(m => ({ ...m, [col]: e.target.value }))}
                    className="h-7 rounded-md border border-gray-200 px-2 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                    aria-label={`Field type for ${col}`}
                  >
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-gray-400 truncate max-w-[160px]">
                  {String(preview[0]?.[col] ?? '')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function periodOptions(type: 'month' | 'quarter'): { value: string; label: string }[] {
  const now = new Date()
  const options: { value: string; label: string }[] = []
  if (type === 'month') {
    for (let offset = -35; offset <= 11; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      options.push({ value, label })
    }
  } else {
    const currentQ = Math.floor(now.getMonth() / 3) + 1
    for (let yOffset = -3; yOffset <= 1; yOffset++) {
      const year = now.getFullYear() + yOffset
      const maxQ = yOffset === 1 ? currentQ + 1 : 4
      for (let q = 1; q <= maxQ && q <= 4; q++) options.push({ value: `${year}-Q${q}`, label: `Q${q} ${year}` })
    }
  }
  return options.reverse()
}

export function ImportClient() {
  const { currentProgram } = useProgram()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null)
  const [savingMappings, setSavingMappings] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | ''>('')
  const [periodValue, setPeriodValue] = useState('')

  const loadJobs = useCallback(async () => {
    if (!currentProgram) return
    const res = await fetch(`/api/import?program_id=${currentProgram.id}`)
    if (res.ok) setJobs(await res.json())
    setLoaded(true)
  }, [currentProgram])

  // Lazy load on first render
  if (currentProgram && !loaded) loadJobs()

  async function handleFile(file: File) {
    if (!currentProgram) return
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!allowed.includes(file.type) && !file.name.match(/\.(csv|xlsx?)$/i)) {
      toast.error('Only CSV and Excel files are supported')
      return
    }

    setUploading(true)
    try {
      const text = await file.text()
      const preview = parseCsv(text)
      if (preview.length === 0) {
        toast.error('Could not parse file — check that it has headers and data rows')
        return
      }
      const rowCount = text.trim().split('\n').length - 1

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: currentProgram.id,
          file_name: file.name,
          file_url: '',
          preview_data: preview,
          row_count: rowCount,
          period_type: periodType || undefined,
          period_value: periodValue || undefined,
        }),
      })

      if (res.ok) {
        const job = await res.json()
        setJobs(j => [job, ...j])
        setActiveJob(job)
        toast.success('File analyzed — review the column mappings below')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to process file')
      }
    } catch {
      toast.error('Failed to read file')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  async function saveMappings(mappings: Record<string, string>) {
    if (!activeJob) return
    setSavingMappings(true)
    const res = await fetch(`/api/import/${activeJob.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_mappings: mappings, status: 'complete' }),
    })
    if (res.ok) {
      const updated = await res.json()
      setJobs(j => j.map(x => x.id === updated.id ? updated : x))
      setActiveJob(null)
      toast.success('Import complete — column mappings saved')
    } else {
      toast.error('Failed to save mappings')
    }
    setSavingMappings(false)
  }

  return (
    <div className="max-w-4xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Import Data</h1>
        <p className="mt-0.5 text-[14px] text-gray-500">Upload a CSV or Excel file — AI will detect column types automatically.</p>
      </div>

      {/* Period picker */}
      <div className="mb-4 rounded-xl border border-gray-100 bg-white shadow-sm px-5 py-4 flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-[13px] font-semibold text-gray-800">Reporting period</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Assign this data to a specific month or quarter</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={periodType}
            onChange={e => { setPeriodType(e.target.value as 'month' | 'quarter' | ''); setPeriodValue('') }}
            className="h-8 rounded-md border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
            aria-label="Period type"
          >
            <option value="">No period</option>
            <option value="month">Month / Year</option>
            <option value="quarter">Quarter / Year</option>
          </select>
          {periodType && (
            <select
              value={periodValue}
              onChange={e => setPeriodValue(e.target.value)}
              className="h-8 rounded-md border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
              aria-label="Period value"
            >
              <option value="">Select…</option>
              {periodOptions(periodType).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </div>
        {periodValue && (
          <p className="w-full text-[11px] text-orange-600 font-medium pt-0 -mt-1">
            A form will be created for <strong>{periodOptions(periodType as 'month' | 'quarter').find(o => o.value === periodValue)?.label}</strong> when you confirm mappings.
          </p>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'rounded-xl border-2 border-dashed transition-colors cursor-pointer',
          dragging ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        aria-label="Upload CSV or Excel file"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && document.getElementById('file-input')?.click()}
      >
        <label htmlFor="file-input" className="flex flex-col items-center py-12 cursor-pointer">
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 text-orange-500 animate-spin mb-3" aria-hidden="true" />
              <p className="text-[14px] font-medium text-gray-600">Analyzing file with AI…</p>
              <p className="text-[12px] text-gray-400 mt-1">Detecting column types and mappings</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-gray-300 mb-3" aria-hidden="true" />
              <p className="text-[14px] font-medium text-gray-600">Drop a CSV or Excel file here</p>
              <p className="text-[12px] text-gray-400 mt-1">or click to browse</p>
            </>
          )}
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={onFileInput}
            disabled={uploading}
            aria-label="Select CSV or Excel file"
          />
        </label>
      </div>

      {/* Active job mapping editor */}
      {activeJob && activeJob.status === 'review' && (
        <MappingEditor job={activeJob} onSave={saveMappings} saving={savingMappings} />
      )}

      {/* Job history */}
      {jobs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[13px] font-semibold text-gray-700 mb-3">Import history</h2>
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden" role="list">
            {jobs.map((job, i) => {
              const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending
              const Icon = cfg.icon
              return (
                <div
                  key={job.id}
                  role="listitem"
                  className={cn('flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50', i < jobs.length - 1 && 'border-b border-gray-50')}
                >
                  <FileSpreadsheet className="h-4 w-4 text-gray-300 flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{job.file_name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {job.row_count?.toLocaleString() ?? '—'} rows · {format(new Date(job.created_at), 'MMM d, yyyy h:mm a')}
                      {(() => {
                        const m = (job.column_mappings ?? {}) as Record<string, string>
                        return m._period_value ? ` · ${m._period_value}` : ''
                      })()}
                    </p>
                  </div>
                  <div className={cn('flex items-center gap-1 text-[11px] font-medium', cfg.className)}>
                    <Icon className={cn('h-3.5 w-3.5', job.status === 'processing' && 'animate-spin')} aria-hidden="true" />
                    {cfg.label}
                  </div>
                  {job.status === 'review' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] text-orange-600 hover:text-orange-700"
                      onClick={() => setActiveJob(job)}
                    >
                      Review
                    </Button>
                  )}
                  {job.status === 'failed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => loadJobs()}
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden="true" /> Retry
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
