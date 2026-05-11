'use client'

import { useCallback, useState } from 'react'
import { useProgram } from '@/contexts/program-context'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, RotateCcw, Trash2, Undo2,
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

function parseCsvRows(text: string, maxRows?: number): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  const dataLines = maxRows !== undefined ? lines.slice(1, maxRows + 1) : lines.slice(1)
  return dataLines.map(line => {
    const vals = line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

/** Returns only first 10 rows — used for AI schema detection preview */
function parseCsvPreview(text: string): Record<string, string>[] { return parseCsvRows(text, 10) }
/** Returns ALL rows — used for actual submission creation */
function parseCsvAll(text: string): Record<string, string>[] { return parseCsvRows(text) }

interface MappingEditorProps {
  job: ImportJob
  onSave: (mappings: Record<string, string>) => Promise<void>
  saving: boolean
}

// Field types that are valid for the "Map to type" selector
const VALID_FIELD_TYPES = new Set([
  'text', 'number', 'date', 'email', 'single_choice', 'multiple_choice',
  'scale', 'boolean', 'name', 'identifier', 'skip',
])

function MappingEditor({ job, onSave, saving }: MappingEditorProps) {
  const schema = (job.detected_schema ?? {}) as Record<string, string>
  const rawMappings = (job.column_mappings ?? {}) as Record<string, string>
  const initialPeriodType = (rawMappings._period_type ?? '') as 'month' | 'quarter' | ''
  const initialPeriodValue = rawMappings._period_value ?? ''
  const initialPeriodStart = rawMappings._period_start ?? ''
  const initialPeriodEnd = rawMappings._period_end ?? ''

  // Seed type overrides from detected_schema, then overlay any previously saved
  // type overrides (values that are valid field types, not snake_case labels).
  const savedTypeOverrides = Object.fromEntries(
    Object.entries(rawMappings).filter(([k, v]) => !k.startsWith('_period_') && VALID_FIELD_TYPES.has(v))
  )
  const initialMappings: Record<string, string> = { ...schema, ...savedTypeOverrides }

  const [mappings, setMappings] = useState<Record<string, string>>(initialMappings)
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | ''>(initialPeriodType)
  const [periodValue, setPeriodValue] = useState(initialPeriodValue)
  const [periodStart, setPeriodStart] = useState(initialPeriodStart)
  const [periodEnd, setPeriodEnd] = useState(initialPeriodEnd)
  const preview = (job.preview_data ?? []) as Record<string, string>[]

  const FIELD_TYPES: { value: string; label: string }[] = [
    { value: 'skip',           label: "Don't import" },
    { value: 'text',           label: 'Text' },
    { value: 'number',         label: 'Number' },
    { value: 'date',           label: 'Date' },
    { value: 'email',          label: 'Email' },
    { value: 'name',           label: 'Name' },
    { value: 'identifier',     label: 'Identifier' },
    { value: 'single_choice',  label: 'Single choice' },
    { value: 'multiple_choice',label: 'Multiple choice' },
    { value: 'scale',          label: 'Scale / Rating' },
    { value: 'boolean',        label: 'Yes / No' },
  ]

  // Period is complete when both start and end dates are present
  const periodComplete = !!(periodStart && periodEnd)

  function handleSave() {
    const full: Record<string, string> = { ...mappings }
    if (periodType) {
      full._period_type = periodType
      full._period_value = periodValue
      if (periodStart) full._period_start = periodStart
      if (periodEnd) full._period_end = periodEnd
    }
    onSave(full)
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-gray-800">{job.file_name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{job.row_count?.toLocaleString()} rows · AI detected {Object.keys(schema).length} columns</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {!periodComplete && (
            <p className="text-[12px] text-amber-600 font-medium">
              Set a reporting period before confirming
            </p>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !periodComplete}
            className="h-8 text-[12px] bg-orange-600 hover:bg-orange-700 gap-1.5 disabled:opacity-50"
            aria-busy={saving}
            title={!periodComplete ? 'A reporting period is required before you can confirm this import' : undefined}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Confirm & create form'}
          </Button>
        </div>
      </div>

      {/* Period assignment in editor — highlighted amber when not yet set */}
      <div className={cn(
        'px-5 py-3 border-b flex items-center gap-3 flex-wrap',
        periodComplete ? 'bg-gray-50' : 'bg-amber-50 border-amber-100'
      )}>
        <span className={cn('text-[12px] font-medium', periodComplete ? 'text-gray-600' : 'text-amber-700')}>
          Reporting period <span className="text-amber-500" aria-label="required">*</span>
        </span>
        <select
          value={periodType}
          onChange={e => { setPeriodType(e.target.value as 'month' | 'quarter' | ''); setPeriodValue(''); setPeriodStart(''); setPeriodEnd('') }}
          className="h-7 rounded-md border border-gray-200 px-2 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
          aria-label="Period type"
        >
          <option value="">None</option>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
        </select>
        {periodType === 'month' && (
          <select
            value={periodValue}
            onChange={e => {
              const v = e.target.value
              setPeriodValue(v)
              if (v) {
                const [y, m] = v.split('-').map(Number)
                const lastDay = new Date(y, m, 0).getDate()
                setPeriodStart(`${v}-01`)
                setPeriodEnd(`${v}-${String(lastDay).padStart(2, '0')}`)
              }
            }}
            className="h-7 rounded-md border border-gray-200 px-2 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
            aria-label="Month"
          >
            <option value="">Select month…</option>
            {periodOptions('month').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {periodType === 'quarter' && (
          <input
            type="text"
            value={periodValue}
            onChange={e => setPeriodValue(e.target.value)}
            placeholder="e.g. Fall 2025"
            className="h-7 rounded-md border border-gray-200 px-2 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 w-36"
            aria-label="Quarter label"
          />
        )}
        {periodType && (
          <>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
              className="h-7 rounded-md border border-gray-200 px-2 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
              aria-label="Period start date" />
            <span className="text-[11px] text-gray-400">→</span>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
              className="h-7 rounded-md border border-gray-200 px-2 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
              aria-label="Period end date" />
          </>
        )}
        {!periodComplete && !periodType && (
          <span className="text-[11px] text-amber-600 italic">Choose a period type to continue</span>
        )}
        {periodType && !periodComplete && (
          <span className="text-[11px] text-amber-600 italic">
            {periodType === 'month' ? 'Select a month above' : 'Enter a label and start/end dates above'}
          </span>
        )}
        {periodComplete && periodValue && (
          <span className="text-[11px] text-orange-600 font-medium">Form will be created for <strong>{periodValue}</strong></span>
        )}
        {periodComplete && !periodValue && (
          <span className="text-[11px] text-emerald-600 font-medium">✓ {periodStart} → {periodEnd}</span>
        )}
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
            {Object.keys(schema).map(col => {
              const currentType = mappings[col] ?? schema[col] ?? 'text'
              const isSkipped = currentType === 'skip'
              return (
                <tr key={col} className={cn('border-b last:border-0', isSkipped ? 'bg-gray-50 opacity-50' : 'hover:bg-gray-50/50')}>
                  <td className={cn('px-4 py-2.5 font-medium truncate max-w-[200px]', isSkipped ? 'text-gray-400 line-through' : 'text-gray-700')}>{col}</td>
                  <td className="px-4 py-2.5 text-gray-400">{schema[col]}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={currentType}
                      onChange={e => setMappings(m => ({ ...m, [col]: e.target.value }))}
                      className={cn(
                        'h-7 rounded-md border px-2 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400',
                        isSkipped ? 'border-gray-200 text-gray-400' : 'border-gray-200'
                      )}
                      aria-label={`Field type for ${col}`}
                    >
                      {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 truncate max-w-[160px]">
                    {isSkipped ? '—' : String(preview[0]?.[col] ?? '')}
                  </td>
                </tr>
              )
            })}
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
  const [confirmingDelete, setConfirmingDelete] = useState<ImportJob | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | ''>('')
  const [periodValue, setPeriodValue] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const loadJobs = useCallback(async () => {
    if (!currentProgram) return
    const res = await fetch(`/api/import?program_id=${currentProgram.id}`)
    if (res.ok) setJobs(await res.json())
    setLoaded(true)
  }, [currentProgram])

  // Lazy load on first render
  if (currentProgram && !loaded) loadJobs()

  async function handleDelete(job: ImportJob) {
    setDeleting(true)
    const res = await fetch(`/api/import/${job.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setJobs(j => j.filter(x => x.id !== job.id))
      if (activeJob?.id === job.id) setActiveJob(null)
      setConfirmingDelete(null)
      const wasComplete = job.status === 'complete'
      toast.success(wasComplete ? 'Import undone — form and submissions removed' : 'Import deleted')
    } else {
      toast.error('Failed to delete import')
    }
  }

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
      const preview = parseCsvPreview(text)
      if (preview.length === 0) {
        toast.error('Could not parse file — check that it has headers and data rows')
        return
      }
      const allRows = parseCsvAll(text)
      const rowCount = allRows.length

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: currentProgram.id,
          file_name: file.name,
          file_url: '',
          preview_data: allRows,
          row_count: rowCount,
          period_type: periodType || undefined,
          period_value: periodValue || undefined,
          period_start: periodStart || undefined,
          period_end: periodEnd || undefined,
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
      <div className="mb-4 rounded-xl border border-gray-100 bg-white shadow-sm px-5 py-4 flex items-start gap-4 flex-wrap">
        <div className="flex-shrink-0">
          <p className="text-[13px] font-semibold text-gray-800">Reporting period</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Assign this data to a specific month or quarter</p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <select
            value={periodType}
            onChange={e => { setPeriodType(e.target.value as 'month' | 'quarter' | ''); setPeriodValue(''); setPeriodStart(''); setPeriodEnd('') }}
            className="h-8 rounded-md border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
            aria-label="Period type"
          >
            <option value="">No period</option>
            <option value="month">Month / Year</option>
            <option value="quarter">Quarter / Year</option>
          </select>
          {periodType === 'month' && (
            <select
              value={periodValue}
              onChange={e => {
                const v = e.target.value
                setPeriodValue(v)
                if (v) {
                  const [y, m] = v.split('-').map(Number)
                  const lastDay = new Date(y, m, 0).getDate()
                  setPeriodStart(`${v}-01`)
                  setPeriodEnd(`${v}-${String(lastDay).padStart(2, '0')}`)
                }
              }}
              className="h-8 rounded-md border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
              aria-label="Month"
            >
              <option value="">Select…</option>
              {periodOptions('month').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {periodType === 'quarter' && (
            <input
              type="text"
              value={periodValue}
              onChange={e => setPeriodValue(e.target.value)}
              placeholder="e.g. Fall 2025"
              className="h-8 rounded-md border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 w-40"
              aria-label="Quarter label"
            />
          )}
          {periodType && (
            <>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                className="h-8 rounded-md border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                aria-label="Period start date" />
              <span className="text-[11px] text-gray-400">→</span>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                className="h-8 rounded-md border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                aria-label="Period end date" />
            </>
          )}
        </div>
        {periodValue && (
          <p className="w-full text-[11px] text-orange-600 font-medium pt-0 -mt-1">
            A form will be created for <strong>{periodValue}</strong>{periodStart && periodEnd ? ` (${periodStart} → ${periodEnd})` : ''} when you confirm mappings.
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
                  {job.status === 'complete' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={() => setConfirmingDelete(job)}
                      aria-label="Undo import"
                    >
                      <Undo2 className="h-3 w-3" aria-hidden="true" /> Undo
                    </Button>
                  )}
                  {(job.status === 'review' || job.status === 'failed' || job.status === 'pending') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-300 hover:text-red-500 hover:bg-red-50"
                      onClick={() => setConfirmingDelete(job)}
                      aria-label="Delete import"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Delete / Undo confirm dialog */}
      {confirmingDelete && (() => {
        const isComplete = confirmingDelete.status === 'complete'
        const m = (confirmingDelete.column_mappings ?? {}) as Record<string, string>
        const periodLabel = m._period_value ? ` (${m._period_value})` : ''
        const fileName = confirmingDelete.file_name.replace(/\.[^.]+$/, '') + periodLabel
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <h2 id="confirm-delete-title" className="text-[16px] font-semibold text-gray-900 mb-2">
                {isComplete ? 'Undo import?' : 'Delete import?'}
              </h2>
              <p className="text-[13px] text-gray-500 mb-1">
                <strong className="text-gray-700">{fileName}</strong>
                {' '}· {confirmingDelete.row_count?.toLocaleString() ?? '—'} rows
              </p>
              {isComplete ? (
                <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
                  This will permanently delete the imported form and all {confirmingDelete.row_count?.toLocaleString()} submission records created from this import. This cannot be undone.
                </p>
              ) : (
                <p className="text-[13px] text-gray-500 mt-2">
                  This will remove the import job. No form or submissions were created, so nothing else will be affected.
                </p>
              )}
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="ghost" onClick={() => setConfirmingDelete(null)} disabled={deleting} className="h-8 text-[13px]">
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDelete(confirmingDelete)}
                  disabled={deleting}
                  aria-busy={deleting}
                  className={cn('h-8 text-[13px] gap-1.5', isComplete ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700')}
                >
                  {deleting
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> {isComplete ? 'Undoing…' : 'Deleting…'}</>
                    : isComplete
                      ? <><Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Yes, undo import</>
                      : <><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete</>
                  }
                </Button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
