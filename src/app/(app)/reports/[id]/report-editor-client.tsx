'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Save, Sparkles, Bold, Italic, List, ListOrdered,
  Heading2, Heading3, Quote, Minus, Calendar, CheckSquare, Square,
  Download, CheckCircle2, RotateCcw, BarChart2, ChevronDown, ChevronUp,
  ImagePlus, Loader2,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { createRoot } from 'react-dom/client'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType,
  LevelFormat,
} from 'docx'
import type { Database } from '@/types/database'
import type { FormSettings } from '@/types/forms'

// ---------------------------------------------------------------------------
// Saved visualization types + chart renderer
// ---------------------------------------------------------------------------

interface ChartConfig {
  title: string
  description: string
  chart_type: 'bar' | 'line' | 'area' | 'pie'
  data: Record<string, unknown>[]
  x_key: string
  y_keys: string[]
  x_label?: string
  y_label?: string
  series_labels?: Record<string, string>
}

interface SavedViz {
  id: string
  title: string
  description: string | null
  prompt: string
  config: ChartConfig
  created_by_email: string | null
  created_at: string
}

const CHART_COLORS = ['#f97316','#3b82f6','#22c55e','#a855f7','#f43f5e','#eab308','#06b6d4','#ec4899']

function StaticChart({ config }: { config: ChartConfig }) {
  const seriesLabel = (k: string) => config.series_labels?.[k] ?? k
  const tooltip = { contentStyle: { backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: 6, fontSize: 12 } }
  const common = { data: config.data, margin: { top: 10, right: 20, left: 0, bottom: 5 } }
  const xAxis = <XAxis dataKey={config.x_key} tick={{ fontSize: 11, fill: '#52525b' }} />
  const yAxis = <YAxis tick={{ fontSize: 11, fill: '#52525b' }} />

  if (config.chart_type === 'pie') {
    return (
      <PieChart width={560} height={300}>
        <Pie data={config.data} dataKey={config.y_keys[0]} nameKey={config.x_key} cx="50%" cy="50%" outerRadius={110}
          label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}>
          {config.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip {...tooltip} /><Legend />
      </PieChart>
    )
  }
  if (config.chart_type === 'line') {
    return (
      <LineChart width={560} height={300} {...common}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />{xAxis}{yAxis}
        <Tooltip {...tooltip} /><Legend />
        {config.y_keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} name={seriesLabel(k)} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />)}
      </LineChart>
    )
  }
  if (config.chart_type === 'area') {
    return (
      <AreaChart width={560} height={300} {...common}>
        <defs>{config.y_keys.map((k, i) => <linearGradient key={k} id={`rg-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.2} /><stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} /></linearGradient>)}</defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />{xAxis}{yAxis}
        <Tooltip {...tooltip} /><Legend />
        {config.y_keys.map((k, i) => <Area key={k} type="monotone" dataKey={k} name={seriesLabel(k)} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={`url(#rg-${i})`} strokeWidth={2} />)}
      </AreaChart>
    )
  }
  return (
    <BarChart width={560} height={300} {...common}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />{xAxis}{yAxis}
      <Tooltip {...tooltip} /><Legend />
      {config.y_keys.map((k, i) => <Bar key={k} dataKey={k} name={seriesLabel(k)} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3,3,0,0]} />)}
    </BarChart>
  )
}

/** Renders a chart off-screen and returns a PNG data URL */
async function chartToPng(config: ChartConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:560px;height:300px;background:#fff;'
    document.body.appendChild(container)

    const root = createRoot(container)
    root.render(<StaticChart config={config} />)

    // Give Recharts time to render
    setTimeout(async () => {
      try {
        const svg = container.querySelector('svg')
        if (!svg) throw new Error('No SVG found')
        const svgStr = new XMLSerializer().serializeToString(svg)
        const img = new window.Image()
        const blob = new Blob([svgStr], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        img.src = url
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej })
        const canvas = document.createElement('canvas')
        canvas.width = 560 * 2
        canvas.height = 300 * 2
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.scale(2, 2)
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        const dataUrl = canvas.toDataURL('image/png')
        resolve(dataUrl)
      } catch (e) {
        reject(e)
      } finally {
        root.unmount()
        document.body.removeChild(container)
      }
    }, 400)
  })
}

// ---------------------------------------------------------------------------
// HTML → docx conversion
// ---------------------------------------------------------------------------

interface RunStyle { bold?: boolean; italics?: boolean; strike?: boolean }

function textRunsFromNode(node: Node, style: RunStyle = {}): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    return text ? [new TextRun({ text, ...style })] : []
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const childStyle: RunStyle = {
    bold: style.bold || tag === 'strong' || tag === 'b',
    italics: style.italics || tag === 'em' || tag === 'i',
    strike: style.strike || tag === 's' || tag === 'del',
  }
  return Array.from(el.childNodes).flatMap(c => textRunsFromNode(c, childStyle))
}

function paragraphsFromNode(node: Element): Paragraph[] {
  const tag = node.tagName.toLowerCase()

  // Headings
  const headingMap: Record<string, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
    h1: HeadingLevel.HEADING_1,
    h2: HeadingLevel.HEADING_2,
    h3: HeadingLevel.HEADING_3,
    h4: HeadingLevel.HEADING_4,
  }
  if (headingMap[tag]) {
    return [new Paragraph({
      text: node.textContent ?? '',
      heading: headingMap[tag],
      spacing: { before: 240, after: 80 },
    })]
  }

  // Horizontal rule
  if (tag === 'hr') {
    return [new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
      spacing: { before: 120, after: 120 },
    })]
  }

  // Blockquote
  if (tag === 'blockquote') {
    return [new Paragraph({
      children: Array.from(node.childNodes).flatMap(c =>
        c.nodeType === Node.ELEMENT_NODE ? textRunsFromNode(c) : []
      ),
      indent: { left: 720 },
      shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' },
      spacing: { before: 80, after: 80 },
    })]
  }

  // Bullet list
  if (tag === 'ul') {
    return Array.from(node.querySelectorAll(':scope > li')).map(li =>
      new Paragraph({
        children: Array.from(li.childNodes).flatMap(c => textRunsFromNode(c)),
        bullet: { level: 0 },
        spacing: { before: 40, after: 40 },
      })
    )
  }

  // Ordered list
  if (tag === 'ol') {
    return Array.from(node.querySelectorAll(':scope > li')).map((li, idx) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${idx + 1}. ` }),
          ...Array.from(li.childNodes).flatMap(c => textRunsFromNode(c)),
        ],
        spacing: { before: 40, after: 40 },
      })
    )
  }

  // Regular paragraph (p, div, etc.)
  const runs = Array.from(node.childNodes).flatMap(c => textRunsFromNode(c))
  if (!runs.length && !node.textContent?.trim()) return []
  return [new Paragraph({
    children: runs.length ? runs : [new TextRun({ text: node.textContent ?? '' })],
    spacing: { before: 80, after: 80 },
  })]
}

function htmlToDocxParagraphs(html: string): Paragraph[] {
  const div = document.createElement('div')
  div.innerHTML = html
  return Array.from(div.children).flatMap(el => paragraphsFromNode(el as Element))
}

async function downloadAsDocx(reportName: string, html: string) {
  const paragraphs = htmlToDocxParagraphs(html)

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'ordered-list',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: reportName,
          heading: HeadingLevel.TITLE,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
            color: '6B7280',
            size: 20,
          })],
          spacing: { after: 400 },
        }),
        ...paragraphs,
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${reportName.replace(/[^a-z0-9]+/gi, '_')}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

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
  // Month: format YYYY-MM as "Nov 2025"
  if (s.periodType === 'month' && s.periodValue) {
    const [y, m] = s.periodValue.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  // Quarter with label: "Fall 2025 · Oct 1 – Dec 31"
  if (s.periodValue && s.periodStart && s.periodEnd) {
    return `${s.periodValue} · ${s.periodStart} – ${s.periodEnd}`
  }
  // Label only
  if (s.periodValue) return s.periodValue
  // Date range only (label was left blank)
  if (s.periodStart && s.periodEnd) return `${s.periodStart} – ${s.periodEnd}`
  return ''
}

function derivePeriods(forms: FormRow[]): Period[] {
  const map = new Map<string, Period>()
  forms.forEach(f => {
    const s = formSettings(f)
    // Need at minimum a start and end date to define a period
    if (!s.periodStart || !s.periodEnd) return
    // Use periodValue as the grouping key; fall back to date range string
    const key = s.periodValue || `${s.periodStart}|${s.periodEnd}`
    const existing = map.get(key)
    if (existing) {
      existing.formIds.push(f.id)
    } else {
      map.set(key, {
        value: key,
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
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState<'draft' | 'final'>(initialReport.status as 'draft' | 'final' ?? 'draft')
  const [togglingStatus, setTogglingStatus] = useState(false)
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

  // Saved visualizations
  const [savedVizs, setSavedVizs] = useState<SavedViz[]>([])
  const [vizPanelOpen, setVizPanelOpen] = useState(true)
  const [insertingVizId, setInsertingVizId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/visualizations?program_id=${initialReport.program_id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSavedVizs(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [initialReport.program_id])

  async function insertChart(viz: SavedViz) {
    setInsertingVizId(viz.id)
    try {
      const png = await chartToPng(viz.config)
      const html = `<figure style="margin:1.5em 0;text-align:center;">
        <img src="${png}" alt="${viz.title}" style="max-width:100%;border-radius:8px;border:1px solid #e4e4e7;" />
        <figcaption style="font-size:12px;color:#71717a;margin-top:6px;">${viz.title}${viz.description ? ` — ${viz.description}` : ''}</figcaption>
      </figure>`
      editor?.chain().focus().insertContentAt(editor.state.doc.content.size, html).run()
      setDirty(true)
      toast.success(`"${viz.title}" inserted into report`)
    } catch {
      toast.error('Failed to render chart — try again')
    } finally {
      setInsertingVizId(null)
    }
  }

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: true }),
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

  async function handleToggleStatus() {
    const newStatus = status === 'draft' ? 'final' : 'draft'
    setTogglingStatus(true)
    const res = await fetch(`/api/reports/${initialReport.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setTogglingStatus(false)
    if (res.ok) {
      setStatus(newStatus)
      toast.success(newStatus === 'final' ? 'Report marked as final' : 'Reverted to draft')
    } else {
      toast.error('Failed to update status')
    }
  }

  async function handleExport() {
    if (!editor) return
    setExporting(true)
    try {
      await downloadAsDocx(name, editor.getHTML())
      toast.success('Downloaded as .docx')
    } catch {
      toast.error('Failed to export document')
    }
    setExporting(false)
  }

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
          // In period mode, submissions were imported with submitted_at set to the
          // period end date (or today for older imports). Tell the API to match by
          // the form's assigned period rather than submitted_at timestamp.
          date_mode: dateMode === 'period' ? 'form_period' : 'submitted_at',
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 text-[13px] h-8" onClick={handleExport} disabled={exporting} aria-label="Download as Word document">
            <Download className={iconSize} aria-hidden="true" />
            {exporting ? 'Exporting…' : '.docx'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 text-[13px] h-8 ${status === 'final' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'text-gray-600'}`}
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            aria-label={status === 'draft' ? 'Mark report as final' : 'Revert report to draft'}
          >
            {status === 'final'
              ? <><RotateCcw className={iconSize} aria-hidden="true" /> Revert to draft</>
              : <><CheckCircle2 className={iconSize} aria-hidden="true" /> Mark as final</>
            }
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-[13px] h-8" onClick={() => save()} disabled={saving} aria-label="Save report">
            <Save className={iconSize} aria-hidden="true" /> Save
          </Button>
        </div>
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

            {/* ── Saved Charts ── */}
            <div className="border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setVizPanelOpen(v => !v)}
                className="flex w-full items-center justify-between text-[12px] font-medium text-gray-600 hover:text-gray-900 mb-2"
              >
                <span className="flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5 text-orange-500" />
                  Saved Charts
                </span>
                {vizPanelOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {vizPanelOpen && (
                savedVizs.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">
                    No saved charts yet. Generate and save charts in the Data Visualizer.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {savedVizs.map(viz => (
                      <div key={viz.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-gray-800 truncate">{viz.title}</p>
                          <p className="text-[10px] text-gray-400 capitalize">{viz.config.chart_type} chart</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] flex-shrink-0 gap-1"
                          disabled={insertingVizId === viz.id}
                          onClick={() => insertChart(viz)}
                        >
                          {insertingVizId === viz.id
                            ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            : <ImagePlus className="h-2.5 w-2.5" />
                          }
                          {insertingVizId === viz.id ? '…' : 'Insert'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
