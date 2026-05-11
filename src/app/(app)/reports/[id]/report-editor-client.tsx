'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Save, Sparkles, Bold, Italic, List, ListOrdered,
  Heading2, Heading3, Quote, Minus, Calendar,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import type { Database } from '@/types/database'

type Report = Database['public']['Tables']['reports']['Row']

const SUMMARY_TYPES = [
  { key: 'key_themes',   label: 'Key Themes' },
  { key: 'trend',        label: 'Trend Analysis' },
  { key: 'impact_story', label: 'Impact Story' },
  { key: 'logic_model',  label: 'Logic Model' },
] as const

type SummaryType = typeof SUMMARY_TYPES[number]['key']

interface Props {
  initialReport: Report
  forms: { id: string; name: string }[]
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
  const [selectedFormId, setSelectedFormId] = useState<string>(forms[0]?.id ?? '')
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 90), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
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

  async function generateSection() {
    if (!selectedFormId && forms.length > 0) {
      toast.error('Select a form first')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: initialReport.program_id,
          form_id: selectedFormId || undefined,
          date_from: dateFrom,
          date_to: dateTo,
          summary_type: summaryType,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        // Insert generated content at end of editor
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
          {/* Formatting toolbar */}
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

          {/* Editor */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="max-w-3xl mx-auto px-8 py-8">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Right: AI panel */}
        <aside className="w-[260px] flex-shrink-0 border-l bg-white overflow-y-auto flex flex-col" aria-label="AI assistant">
          <div className="px-4 py-3.5 border-b">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
              <h2 className="text-[13px] font-semibold text-gray-800">AI section generator</h2>
            </div>
            <p className="text-[11px] text-gray-400">Generate content from your submission data and insert it into the report.</p>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* Form selector */}
            {forms.length > 0 && (
              <div>
                <label htmlFor="ai-form" className="text-[12px] font-medium text-gray-600 block mb-1.5">Form</label>
                <select
                  id="ai-form"
                  value={selectedFormId}
                  onChange={e => setSelectedFormId(e.target.value)}
                  className="w-full h-8 rounded-lg border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">All forms</option>
                  {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}

            {/* Date range */}
            <div>
              <label className="text-[12px] font-medium text-gray-600 block mb-1.5">
                <Calendar className="inline h-3 w-3 mr-1" aria-hidden="true" />Date range
              </label>
              <div className="space-y-1.5">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full h-8 rounded-lg border border-gray-200 px-2.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400" aria-label="Start date" />
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full h-8 rounded-lg border border-gray-200 px-2.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400" aria-label="End date" />
              </div>
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
              disabled={generating}
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
