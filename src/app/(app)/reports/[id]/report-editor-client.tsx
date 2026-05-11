'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Save, Sparkles, Bold, Italic, List, ListOrdered,
  Heading2, Heading3, Quote, Minus, Calendar, CheckSquare, Square,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import type { Database } from '@/types/database'
import type { FormSettings } from '@/types/forms'

type Report = Database['public']['Tables']['reports']['Row']

interface FormRow {
  id: string
  name: string
  settings: Record<string, unknown> | null
}

interface Period {
  value: string
  label: string
  start: string
  end: string
  formIds: string[]
}

const SUMMARY_TYPES = [
  { key: 'key_themes',   label: 'Key Themes' },
  { key: 'trend',        label: 'Trend Analysis' },
  { key: 'impact_story', label: 'Impact Story' },
  { key: 'logic_model',  label: 'Logic Model' },
] as const

type SummaryType = typeof SUMMARY_TYPES[number]['key']

interface Props {
  initialReport: Report
  forms: FormRow[]
}

function formSettings(f: FormRow): FormSettings {
  return (f.settings ?? {}) as FormSettings
}

function formatPeriodLabel(s: FormSettings): string {
  if (!s.periodValue) return ''
  if (s.periodType === 'month') {
    const [y, m] = s.periodValue.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  if (s.periodStart && s.periodEnd) {
    return `${s.periodValue} · ${s.periodStart} – ${s.periodEnd}`
  }
  return s.periodValue
}

function derivePeriods(forms: FormRow[]): Period[] {
  const map = new Map<string, Period>()
  forms.forEach(f => {
    const s = formSettings(f)
    if (!s.periodValue || !s.periodStart || !s.periodEnd) return
    const existing = map.get(s.periodValue)
    if (existing) {
      existing.formIds.push(f.id)
    } else {
      map.set(s.periodValue, {
        value: s.periodValue,
        label: formatPeriodLabel(s),
        start: s.periodStart,
        end: s.periodEnd,
        formIds: [f.id],
      })
    }
  })
  return [...map.values()].sort((a, b) => a.start.localeCompare(b.start))
}

function ToolbarButton({ onClick, active, title, children }: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`p-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${active ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
    >
      {children}
    </button>
  )
}

export function ReportEditorClient({ initialReport, forms }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialReport.name)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [summaryType, setSummaryType] = useState<SummaryType>('key_themes')

  // Form multi-select — default: all forms selected
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(
    () => new Set(forms.map(f => f.id))
  )

  // Date mode
  const [dateMode, setDateMode] = useState<'manual' | 'period'>('manual')
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 90), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')

  const periods = derivePeriods(forms)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your report, or use AI to generate a section…' }),
      Typography,
    ],
    content: (() => {
      const raw = initialReport.content as Record<string, unknown> | null
      return (raw?.body as string) ?? ''
    })(),
    onUpdate: () => {
      setDirty(true)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => autoSave(), 3000)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] text-[14px] text-gray-800 leading-relaxed',
        'aria-label': 'Report body',
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
  })

  const save = useCallback(async (showToast = true) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setSaving(true)
    const body = editor?.getHTML() ?? ''
    const res = await fetch(`/api/reports/${initialReport.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content: { body } }),
    })
    setSaving(false)
    if (res.ok) {
      setDirty(false)
      if (showToast) toast.success('Saved')
    } else {
      toast.error('Failed to save')
    }
  }, [editor, name, initialReport.id])

  function autoSave() { save(false) }

  function toggleForm(id: string) {
    setSelectedFormIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleAllForms() {
    if (selectedFormIds.size === forms.length) {
      setSelectedFormIds(new Set())
    } else {
      setSelectedFormIds(new Set(forms.map(f => f.id)))
    }
  }

  function handlePeriodChange(periodValue: string) {
    setSelectedPeriod(periodValue)
    const p = periods.find(x => x.value === periodValue)
    if (p) {
      setDateFrom(p.start)
      setDateTo(p.end)
      setSelectedFormIds(new Set(p.formIds))
    }
  }

  async function generateSection() {
    const formIds = [...selectedFormIds]
    if (formIds.length === 0) {
      toast.error('Select at least one form')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: initialReport.program_id,
          form_ids: formIds,
          date_from: dateFrom,
          date_to: dateTo,
          summary_type: summaryType,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const label = SUMMARY_TYPES.find(t => t.key === summaryType)?.label ?? 'AI Section'
        const insertHtml = `<h2>${label}</h2><p>${data.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
        editor?.chain().focus().insertContentAt(editor.state.doc.content.size, insertHtml).run()
        setDirty(true)
        toast.success('AI section inserted')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to generate section')
      }
    } catch {
      toast.error('Failed to connect to AI service')
    }
    setGenerating(false)
  }

  const iconSize = 'h-3.5 w-3.5'
  const allSelected = selectedFormIds.size === forms.length
  const someSelected = selectedFormIds.size > 0 && !allSelected

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex h-12 flex-shrink-0 items-center justify-between border-b bg-white px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => router.push('/reports')} aria-label="Back to reports">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setDirty(true) }}
            className="text-[14px] font-semibold text-gray-800 bg-transparent border-none outline-none focus:ring-0 truncate min-w-0 w-full max-w-sm"
            aria-label="Report name"
          />
          {saving && <span className="text-[12px] text-gray-400 flex-shrink-0" aria-live="polite">Saving…</span>}
          {dirty && !saving && <span className="text-[12px] text-gray-400 flex-shrink-0" aria-live="polite">Unsaved</span>}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-[13px] h-8 flex-shrink-0" onClick={() => save()} disabled={saving} aria-label="Save report">
          <Save className={iconSize} aria-hidden="true" /> Save
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {editor && (
            <div className="flex items-center gap-0.5 border-b bg-white px-4 py-1.5 flex-wrap" role="toolbar" aria-label="Text formatting">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold className={iconSize} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic className={iconSize} /></ToolbarButton>
              <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden="true" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 className={iconSize} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 className={iconSize} /></ToolbarButton>
              <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden="true" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><List className={iconSize} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered className={iconSize} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote"><Quote className={iconSize} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus className={iconSize} /></ToolbarButton>
            </div>
          )}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="max-w-3xl mx-auto px-8 py-8">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Right: AI panel */}
        <aside className="w-[280px] flex-shrink-0 border-l bg-white overflow-y-auto flex flex-col" aria-label="AI assistant">
          <div className="px-4 py-3.5 border-b">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
              <h2 className="text-[13px] font-semibold text-gray-800">AI section generator</h2>
            </div>
            <p className="text-[11px] text-gray-400">Generate content from your submission data and insert it into the report.</p>
          </div>

          <div className="p-4 space-y-4 flex-1">

            {/* Form multi-select */}
            {forms.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-medium text-gray-600">Forms</label>
                  <button
                    type="button"
                    onClick={toggleAllForms}
                    className="text-[11px] text-orange-600 hover:text-orange-700 font-medium focus:outline-none"
                  >
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="max-h-[160px] overflow-y-auto space-y-1 rounded-lg border border-gray-200 p-2">
                  {forms.map(f => {
                    const checked = selectedFormIds.has(f.id)
                    return (
                      <label key={f.id} className="flex items-start gap-2 cursor-pointer group">
                        <span className="flex-shrink-0 mt-0.5">
                          {checked
                            ? <CheckSquare className="h-3.5 w-3.5 text-orange-600" aria-hidden="true" />
                            : <Square className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400" aria-hidden="true" />
                          }
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleForm(f.id)}
                          className="sr-only"
                          aria-label={f.name}
                        />
                        <span className="text-[12px] text-gray-700 leading-tight line-clamp-2">{f.name}</span>
                      </label>
                    )
                  })}
                </div>
                {someSelected && (
                  <p className="text-[11px] text-gray-400 mt-1">{selectedFormIds.size} of {forms.length} selected</p>
                )}
              </div>
            )}

            {/* Date source toggle */}
            <div>
              <label className="text-[12px] font-medium text-gray-600 block mb-1.5">
                <Calendar className="inline h-3 w-3 mr-1" aria-hidden="true" />Data source
              </label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-3" role="group" aria-label="Date filter mode">
                {(['manual', 'period'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDateMode(mode)}
                    aria-pressed={dateMode === mode}
                    className={`flex-1 py-1 text-[11px] font-medium transition-colors focus:outline-none ${dateMode === mode ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {mode === 'manual' ? 'Date range' : 'Reporting period'}
                  </button>
                ))}
              </div>

              {dateMode === 'manual' ? (
                <div className="space-y-1.5">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full h-8 rounded-lg border border-gray-200 px-2.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400" aria-label="Start date" />
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full h-8 rounded-lg border border-gray-200 px-2.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400" aria-label="End date" />
                </div>
              ) : periods.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic">No reporting periods found. Assign periods to your forms in Form Settings.</p>
              ) : (
                <div>
                  <select
                    value={selectedPeriod}
                    onChange={e => handlePeriodChange(e.target.value)}
                    className="w-full h-8 rounded-lg border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                    aria-label="Select reporting period"
                  >
                    <option value="">Select a period…</option>
                    {periods.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  {selectedPeriod && (
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      Using dates {dateFrom} → {dateTo} · {selectedFormIds.size} form{selectedFormIds.size !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Section type */}
            <div>
              <label className="text-[12px] font-medium text-gray-600 block mb-1.5">Section type</label>
              <div className="space-y-1">
                {SUMMARY_TYPES.map(t => (
                  <label key={t.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="summary-type"
                      value={t.key}
                      checked={summaryType === t.key}
                      onChange={() => setSummaryType(t.key)}
                      className="h-3.5 w-3.5 text-orange-600 border-gray-300 focus:ring-orange-500"
                    />
                    <span className="text-[12px] text-gray-700">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              onClick={generateSection}
              disabled={generating || selectedFormIds.size === 0}
              aria-busy={generating}
              className="w-full gap-1.5 text-[12px] h-8 bg-orange-600 hover:bg-orange-700"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {generating ? 'Generating…' : 'Insert AI section'}
            </Button>

            {generating && (
              <p className="text-[11px] text-gray-400 text-center" aria-live="polite">
                Analyzing submissions and writing content…
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
