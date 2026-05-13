'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useProgram } from '@/contexts/program-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Mic,
  MicOff,
  Link2,
  Paperclip,
  Send,
  Trash2,
  Pencil,
  X,
  Check,
  FileText,
  Calendar,
  AlertCircle,
  Loader2,
  Search,
  ChevronUp,
  ChevronDown,
  Radio,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Attachment {
  name: string
  url: string
  size: number
  type: string
  extracted_text?: string | null
}

interface PulseNote {
  id: string
  title: string | null
  content: string
  source: 'typed' | 'voice' | 'google_doc' | 'attachment'
  note_date: string
  google_doc_url: string | null
  attachments: Attachment[]
  created_at: string
  updated_at: string
  author_id: string
  author_email: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const SOURCE_LABELS: Record<string, string> = {
  typed: 'Typed',
  voice: 'Voice',
  google_doc: 'Google Doc',
  attachment: 'Attachment',
}

// SpeechRecognition type shim
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
}

// ---------------------------------------------------------------------------
// AttachmentChip
// ---------------------------------------------------------------------------

function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
      <FileText className="h-3 w-3 text-zinc-400 flex-shrink-0" />
      <a href={attachment.url} target="_blank" rel="noopener noreferrer"
        className="truncate max-w-[120px] hover:underline">
        {attachment.name}
      </a>
      <span className="text-zinc-400">{fileSize(attachment.size)}</span>
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 text-zinc-400 hover:text-red-500">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Note detail dialog — shown when a row is clicked
// ---------------------------------------------------------------------------

function NoteDetailDialog({
  note,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
  onClose,
}: {
  note: PulseNote
  currentUserId: string
  isAdmin: boolean
  onEdit: (note: PulseNote) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isOwn = note.author_id === currentUserId
  const canEdit = isOwn
  const canDelete = isOwn || isAdmin

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="pr-6">
          {note.title ?? formatDate(note.note_date)}
        </DialogTitle>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {note.title && (
            <span className="text-xs text-zinc-500">{formatDate(note.note_date)}</span>
          )}
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600">
            {SOURCE_LABELS[note.source] ?? note.source}
          </span>
          <span className="text-[11px] text-zinc-400">
            {isOwn ? 'You' : (note.author_email ?? 'Unknown')}
          </span>
        </div>
      </DialogHeader>

      <div className="space-y-4 pt-1">
        {/* Content */}
        <p className="whitespace-pre-wrap text-sm text-zinc-800 leading-relaxed max-h-64 overflow-y-auto">
          {note.content}
        </p>

        {/* Google Doc link */}
        {note.google_doc_url && (
          <a href={note.google_doc_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
            <Link2 className="h-3 w-3" />
            Source Google Doc
          </a>
        )}

        {/* Attachments */}
        {note.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {note.attachments.map((a, i) => <AttachmentChip key={i} attachment={a} />)}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
          <div className="flex gap-1.5">
            {canEdit && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
                onClick={() => { onClose(); onEdit(note) }}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            {canDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-600">Delete this note?</span>
                  <Button variant="destructive" size="sm" className="h-7 text-xs"
                    onClick={() => { onDelete(note.id); onClose() }}>
                    Delete
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm"
                  className="h-7 text-xs text-zinc-400 hover:text-red-500 hover:bg-red-50 gap-1.5"
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              )
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

// ---------------------------------------------------------------------------
// Sort indicator icon
// ---------------------------------------------------------------------------

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronDown className="h-3 w-3 text-zinc-300" />
  return dir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-orange-500" />
    : <ChevronDown className="h-3 w-3 text-orange-500" />
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type SortField = 'date' | 'author'
type SortDir = 'asc' | 'desc'

export function PulseClient() {
  const { currentProgram, currentRole } = useProgram()
  const isAdmin = currentRole === 'super_admin' || currentRole === 'program_admin'

  // Notes state
  const [notes, setNotes] = useState<PulseNote[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')

  // List controls
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewNote, setViewNote] = useState<PulseNote | null>(null)

  // Compose state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [noteDate, setNoteDate] = useState(todayIso())
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)
  const [composeError, setComposeError] = useState('')

  // Voice
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [hasSpeech, setHasSpeech] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const interimRef = useRef('')
  const baseContentRef = useRef('')
  const finalTranscriptRef = useRef('')

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Google Doc import dialog
  const [gdocOpen, setGdocOpen] = useState(false)
  const [gdocUrl, setGdocUrl] = useState('')
  const [gdocLoading, setGdocLoading] = useState(false)
  const [gdocError, setGdocError] = useState('')
  const [gdocSource, setGdocSource] = useState('')

  // Edit dialog
  const [editNote, setEditNote] = useState<PulseNote | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([])
  const [editUploading, setEditUploading] = useState(false)
  const [editGdocUrl, setEditGdocUrl] = useState('')
  const [editGdocLoading, setEditGdocLoading] = useState(false)
  const [editGdocError, setEditGdocError] = useState('')
  const [editGdocOpen, setEditGdocOpen] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // Load notes + current user
  // ---------------------------------------------------------------------------

  const loadNotes = useCallback(async (programId: string) => {
    setNotes([])
    setLoading(true)
    const res = await fetch(`/api/pulse?program_id=${programId}`)
    if (res.ok) setNotes(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setCurrentUserId(user.id)
      })
    })
  }, [])

  useEffect(() => {
    if (currentProgram) loadNotes(currentProgram.id)
  }, [currentProgram, loadNotes])

  useEffect(() => { setHasSpeech(!!getSpeechRecognition()) }, [])

  // ---------------------------------------------------------------------------
  // Sort + filter
  // ---------------------------------------------------------------------------

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'date' ? 'desc' : 'asc')
    }
  }

  const filtered = notes
    .filter(n => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        n.content.toLowerCase().includes(q) ||
        (n.title ?? '').toLowerCase().includes(q) ||
        (n.author_email ?? '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') {
        cmp = a.note_date.localeCompare(b.note_date)
      } else {
        cmp = (a.author_email ?? '').localeCompare(b.author_email ?? '')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  // ---------------------------------------------------------------------------
  // Voice
  // ---------------------------------------------------------------------------

  function startListening() {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) { setVoiceError('Your browser does not support voice input.'); return }
    setVoiceError('')
    baseContentRef.current = content
    finalTranscriptRef.current = ''
    interimRef.current = ''

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + t.trim()
        } else {
          interim = t
        }
      }
      interimRef.current = interim
      const base = baseContentRef.current
      const finals = finalTranscriptRef.current
      const sep = base && finals ? ' ' : ''
      setContent(base + sep + finals + (finals && interim ? ' ' : '') + interim)
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted') setVoiceError(`Voice error: ${e.error}`)
      setListening(false)
    }
    rec.onend = () => { setListening(false); interimRef.current = '' }
    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  // ---------------------------------------------------------------------------
  // Google Doc import
  // ---------------------------------------------------------------------------

  async function handleGdocImport() {
    if (!gdocUrl.trim()) return
    setGdocLoading(true)
    setGdocError('')
    try {
      const res = await fetch('/api/pulse/import-gdoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: gdocUrl.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setGdocError(json.error ?? 'Failed to import document'); return }
      setContent(prev => prev ? `${prev}\n\n${json.content}` : json.content)
      setGdocSource(gdocUrl.trim())
      setGdocOpen(false)
      setGdocUrl('')
    } catch {
      setGdocError('Network error — please try again')
    } finally {
      setGdocLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // File upload
  // ---------------------------------------------------------------------------

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !currentProgram) return
    setUploading(true)
    setComposeError('')
    const results: Attachment[] = []
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('program_id', currentProgram.id)
      try {
        const res = await fetch('/api/pulse/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (res.ok) { results.push(json) } else { setComposeError(json.error ?? 'File upload failed') }
      } catch {
        setComposeError('Network error during upload — please try again')
      }
    }
    setAttachments(prev => [...prev, ...results])
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ---------------------------------------------------------------------------
  // Save note
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!content.trim() || !currentProgram) return
    setSaving(true)
    setComposeError('')

    const source: PulseNote['source'] = gdocSource
      ? 'google_doc' : listening ? 'voice'
      : attachments.length > 0 ? 'attachment' : 'typed'

    const res = await fetch('/api/pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program_id: currentProgram.id,
        title: title.trim() || undefined,
        content: content.trim(),
        source,
        note_date: noteDate,
        google_doc_url: gdocSource || undefined,
        attachments,
      }),
    })

    if (res.ok) {
      const created = await res.json()
      setNotes(prev => [created, ...prev])
      setTitle('')
      setContent('')
      setNoteDate(todayIso())
      setAttachments([])
      setGdocSource('')
    } else {
      const json = await res.json()
      setComposeError(json.error ?? 'Failed to save note')
    }
    setSaving(false)
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete(id: string) {
    const res = await fetch(`/api/pulse/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) setNotes(prev => prev.filter(n => n.id !== id))
  }

  // ---------------------------------------------------------------------------
  // Edit
  // ---------------------------------------------------------------------------

  function openEdit(note: PulseNote) {
    setEditNote(note)
    setEditTitle(note.title ?? '')
    setEditContent(note.content)
    setEditDate(note.note_date)
    setEditAttachments(note.attachments ?? [])
    setEditGdocUrl('')
    setEditGdocError('')
  }

  async function handleEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !currentProgram) return
    setEditUploading(true)
    const results: Attachment[] = []
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('program_id', currentProgram.id)
      try {
        const res = await fetch('/api/pulse/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (res.ok) results.push(json)
      } catch { /* non-fatal */ }
    }
    setEditAttachments(prev => [...prev, ...results])
    setEditUploading(false)
    if (editFileInputRef.current) editFileInputRef.current.value = ''
  }

  async function handleEditGdocImport() {
    if (!editGdocUrl.trim()) return
    setEditGdocLoading(true)
    setEditGdocError('')
    try {
      const res = await fetch('/api/pulse/import-gdoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: editGdocUrl.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setEditGdocError(json.error ?? 'Failed to import'); return }
      setEditContent(prev => prev ? `${prev}\n\n${json.content}` : json.content)
      setEditGdocOpen(false)
      setEditGdocUrl('')
    } catch {
      setEditGdocError('Network error — please try again')
    } finally {
      setEditGdocLoading(false)
    }
  }

  async function handleEditSave() {
    if (!editNote) return
    setEditSaving(true)
    const res = await fetch(`/api/pulse/${editNote.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle.trim() || null,
        content: editContent.trim(),
        note_date: editDate,
        attachments: editAttachments,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setNotes(prev => prev.map(n => n.id === editNote.id ? updated : n))
      setEditNote(null)
    }
    setEditSaving(false)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!currentProgram) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
        Select a program to view Pulse notes.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-900">Pulse</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Qualitative field notes — capture observations, voice memos, and documents from the field.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Compose panel ── */}
        <div className="w-[360px] flex-shrink-0 border-r border-zinc-200 bg-white flex flex-col">
          <div className="flex-1 no-scrollbar overflow-y-auto p-4 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs font-medium text-zinc-600 mb-1.5 block">
                  Title <span className="text-zinc-400 font-normal">(optional)</span>
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Site visit — Westside"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="text-sm h-8"
                  maxLength={200}
                />
              </div>
              <div className="flex-shrink-0">
                <Label className="text-xs font-medium text-zinc-600 mb-1.5 block">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                  <Input
                    type="date"
                    value={noteDate}
                    onChange={e => setNoteDate(e.target.value)}
                    className="pl-7 text-sm h-8 w-[140px]"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-zinc-600 mb-1.5 block">Your note</Label>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={listening ? 'Listening… speak now' : 'Write your field observation…'}
                className={cn('min-h-[180px] resize-none text-sm leading-relaxed',
                  listening && 'ring-2 ring-red-400 ring-offset-1')}
              />
              {listening && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-red-500">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Recording… click mic to stop
                </div>
              )}
              {voiceError && (
                <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3" />{voiceError}
                </div>
              )}
            </div>

            {/* Tool row */}
            <div className="flex items-center gap-2">
              {hasSpeech && (
                <button type="button" onClick={listening ? stopListening : startListening}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    listening ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  )}>
                  {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {listening ? 'Stop' : 'Voice'}
                </button>
              )}
              <button type="button" onClick={() => { setGdocOpen(true); setGdocError('') }}
                className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                <Link2 className="h-3.5 w-3.5" />Google Doc
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                Attach
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                multiple className="hidden" onChange={handleFileChange} aria-label="Attach files (PDF, images)" />
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((a, i) => (
                  <AttachmentChip key={i} attachment={a}
                    onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}

            {gdocSource && (
              <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
                <Link2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate flex-1">Imported from Google Doc</span>
                <button onClick={() => setGdocSource('')} className="text-blue-400 hover:text-blue-700">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {composeError && (
              <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5" />{composeError}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-100 p-4">
            <Button onClick={handleSave} disabled={!content.trim() || saving}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Save Note
            </Button>
          </div>
        </div>

        {/* ── Notes list ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Toolbar */}
          <div className="border-b border-zinc-100 px-4 py-2.5 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
              <Input
                placeholder="Search notes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <span className="text-xs text-zinc-400 ml-auto">
              {filtered.length} {filtered.length === 1 ? 'note' : 'notes'}
              {search && notes.length !== filtered.length && ` of ${notes.length}`}
            </span>
          </div>

          {/* Table header */}
          {!loading && notes.length > 0 && (
            <div className="grid grid-cols-[130px_1fr_160px_90px] border-b border-zinc-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              <button onClick={() => toggleSort('date')}
                className="flex items-center gap-1 hover:text-zinc-600 transition-colors text-left">
                Date <SortIcon active={sortField === 'date'} dir={sortDir} />
              </button>
              <span>Note</span>
              <button onClick={() => toggleSort('author')}
                className="flex items-center gap-1 hover:text-zinc-600 transition-colors text-left">
                Author <SortIcon active={sortField === 'author'} dir={sortDir} />
              </button>
              <span>Source</span>
            </div>
          )}

          {/* Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-50">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-zinc-400 text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />Loading notes…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Radio className="h-8 w-8 text-zinc-200 mb-3" />
                <p className="text-sm font-medium text-zinc-500">
                  {search ? 'No notes match your search' : 'No notes yet'}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {search ? 'Try a different search term.' : 'Write your first field observation using the panel on the left.'}
                </p>
              </div>
            ) : (
              filtered.map(note => {
                const preview = note.content.replace(/\s+/g, ' ').slice(0, 120)
                const hasAttachments = note.attachments.length > 0
                return (
                  <button
                    key={note.id}
                    onClick={() => setViewNote(note)}
                    className="w-full grid grid-cols-[130px_1fr_160px_90px] items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors group"
                  >
                    {/* Date */}
                    <span className="text-xs text-zinc-500 flex-shrink-0 tabular-nums">
                      {formatDate(note.note_date)}
                    </span>

                    {/* Title + preview */}
                    <span className="min-w-0">
                      {note.title
                        ? <span className="block text-sm font-medium text-zinc-800 truncate">{note.title}</span>
                        : <span className="block text-sm text-zinc-600 truncate">{preview}</span>
                      }
                      {note.title && (
                        <span className="block text-xs text-zinc-400 truncate">{preview}</span>
                      )}
                    </span>

                    {/* Author */}
                    <span className="text-xs text-zinc-500 truncate">
                      {note.author_id === currentUserId ? 'You' : (note.author_email ?? '—')}
                    </span>

                    {/* Source + attachment dot */}
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 whitespace-nowrap">
                        {SOURCE_LABELS[note.source] ?? note.source}
                      </span>
                      {hasAttachments && (
                        <Paperclip className="h-3 w-3 text-zinc-300 flex-shrink-0" />
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Note detail dialog ── */}
      <Dialog open={!!viewNote} onOpenChange={open => { if (!open) setViewNote(null) }}>
        {viewNote && (
          <NoteDetailDialog
            note={viewNote}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onEdit={openEdit}
            onDelete={handleDelete}
            onClose={() => setViewNote(null)}
          />
        )}
      </Dialog>

      {/* ── Google Doc Import Dialog ── */}
      <Dialog open={gdocOpen} onOpenChange={open => { setGdocOpen(open); if (!open) { setGdocUrl(''); setGdocError('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import from Google Docs</DialogTitle>
            <DialogDescription>
              Paste the link to a Google Doc. The document must be shared with the service account email configured in your environment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input type="url" placeholder="https://docs.google.com/document/d/…"
              value={gdocUrl} onChange={e => setGdocUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGdocImport() }} autoFocus />
            {gdocError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{gdocError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setGdocOpen(false); setGdocUrl(''); setGdocError('') }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleGdocImport} disabled={gdocLoading || !gdocUrl.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white">
                {gdocLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editNote} onOpenChange={open => { if (!open) setEditNote(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 max-h-[80vh] overflow-y-auto pr-1">
            {/* Title + Date row */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs font-medium text-zinc-600 mb-1.5 block">
                  Title <span className="text-zinc-400 font-normal">(optional)</span>
                </Label>
                <Input type="text" placeholder="e.g. Site visit — Westside"
                  value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="text-sm h-8" maxLength={200} />
              </div>
              <div className="flex-shrink-0">
                <Label className="text-xs font-medium text-zinc-600 mb-1.5 block">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                  <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                    className="pl-7 text-sm h-8 w-[140px]" />
                </div>
              </div>
            </div>

            {/* Content */}
            <div>
              <Label className="text-xs font-medium text-zinc-600 mb-1.5 block">Note</Label>
              <Textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                className="min-h-[160px] resize-none text-sm" />
            </div>

            {/* Tools row */}
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => { setEditGdocOpen(true); setEditGdocError('') }}
                className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                <Link2 className="h-3.5 w-3.5" />Google Doc
              </button>
              <button type="button"
                onClick={() => editFileInputRef.current?.click()}
                disabled={editUploading}
                className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50">
                {editUploading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Paperclip className="h-3.5 w-3.5" />}
                {editUploading ? 'Uploading…' : 'Attach file'}
              </button>
              <input ref={editFileInputRef} type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp" multiple
                className="hidden" onChange={handleEditFileChange} aria-label="Attach files (PDF, images)" />
            </div>

            {/* Attachments */}
            {editAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {editAttachments.map((a, i) => (
                  <AttachmentChip key={i} attachment={a}
                    onRemove={() => setEditAttachments(prev => prev.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
            <Button variant="ghost" size="sm" onClick={() => setEditNote(null)}>
              <X className="mr-1.5 h-3.5 w-3.5" />Cancel
            </Button>
            <Button size="sm" onClick={handleEditSave} disabled={editSaving || !editContent.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white">
              {editSaving
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Check className="mr-1.5 h-3.5 w-3.5" />}
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit: Google Doc import dialog ── */}
      <Dialog open={editGdocOpen} onOpenChange={open => { setEditGdocOpen(open); if (!open) { setEditGdocUrl(''); setEditGdocError('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import from Google Docs</DialogTitle>
            <DialogDescription>
              Text will be appended to your note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input type="url" placeholder="https://docs.google.com/document/d/…"
              value={editGdocUrl} onChange={e => setEditGdocUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEditGdocImport() }} autoFocus />
            {editGdocError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{editGdocError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditGdocOpen(false); setEditGdocUrl(''); setEditGdocError('') }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleEditGdocImport}
                disabled={editGdocLoading || !editGdocUrl.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white">
                {editGdocLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
