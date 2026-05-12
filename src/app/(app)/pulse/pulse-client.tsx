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
  ChevronDown,
  AlertCircle,
  Loader2,
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
}

interface PulseNote {
  id: string
  content: string
  source: 'typed' | 'voice' | 'google_doc' | 'attachment'
  note_date: string
  google_doc_url: string | null
  attachments: Attachment[]
  created_at: string
  updated_at: string
  author_id: string
  author: { email: string } | null
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

// SpeechRecognition type shim (not in all TS libs)
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
// Sub-components
// ---------------------------------------------------------------------------

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment
  onRemove?: () => void
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
      <FileText className="h-3 w-3 text-zinc-400 flex-shrink-0" />
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate max-w-[120px] hover:underline"
      >
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

function NoteCard({
  note,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
}: {
  note: PulseNote
  currentUserId: string
  isAdmin: boolean
  onEdit: (note: PulseNote) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isOwn = note.author_id === currentUserId
  const canEdit = isOwn
  const canDelete = isOwn || isAdmin

  const sourceLabel: Record<string, string> = {
    typed: 'Typed',
    voice: 'Voice',
    google_doc: 'Google Doc',
    attachment: 'Attachment',
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      {/* Header row */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-900">{formatDate(note.note_date)}</span>
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600">
            {sourceLabel[note.source] ?? note.source}
          </span>
          {isAdmin && note.author && !isOwn && (
            <span className="text-[11px] text-zinc-400">{note.author.email}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {canEdit && (
            <button
              onClick={() => onEdit(note)}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              title="Edit note"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onDelete(note.id)}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                title="Delete note"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      {/* Content */}
      <p className="whitespace-pre-wrap text-sm text-zinc-800 leading-relaxed">{note.content}</p>

      {/* Google Doc link */}
      {note.google_doc_url && (
        <a
          href={note.google_doc_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <Link2 className="h-3 w-3" />
          Source Google Doc
        </a>
      )}

      {/* Attachments */}
      {note.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {note.attachments.map((a, i) => (
            <AttachmentChip key={i} attachment={a} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PulseClient() {
  const { currentProgram, currentRole } = useProgram()
  const isAdmin = currentRole === 'super_admin' || currentRole === 'program_admin'

  // Notes state
  const [notes, setNotes] = useState<PulseNote[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')

  // Compose state
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
  const baseContentRef = useRef('')   // content that existed before recording started
  const finalTranscriptRef = useRef('') // all finals accumulated during this session

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Google Doc import dialog
  const [gdocOpen, setGdocOpen] = useState(false)
  const [gdocUrl, setGdocUrl] = useState('')
  const [gdocLoading, setGdocLoading] = useState(false)
  const [gdocError, setGdocError] = useState('')
  const [gdocSource, setGdocSource] = useState('')  // tracks URL used for this note

  // Edit dialog
  const [editNote, setEditNote] = useState<PulseNote | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // ---------------------------------------------------------------------------
  // Load notes + current user
  // ---------------------------------------------------------------------------

  const loadNotes = useCallback(async (programId: string) => {
    setLoading(true)
    const res = await fetch(`/api/pulse?program_id=${programId}`)
    if (res.ok) setNotes(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    // Get current user id
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

  // ---------------------------------------------------------------------------
  // Check Speech API support on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setHasSpeech(!!getSpeechRecognition())
  }, [])

  // ---------------------------------------------------------------------------
  // Voice
  // ---------------------------------------------------------------------------

  function startListening() {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setVoiceError('Your browser does not support voice input.')
      return
    }
    setVoiceError('')
    // Snapshot the existing text and reset the running transcript
    baseContentRef.current = content
    finalTranscriptRef.current = ''
    interimRef.current = ''

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (e: SpeechRecognitionEvent) => {
      // Only process results starting from e.resultIndex (the new ones this event)
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          // Accumulate finals in a ref so earlier sentences aren't lost
          finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + t.trim()
        } else {
          interim = t
        }
      }
      interimRef.current = interim

      // Rebuild full content: original text + all finals so far + current interim
      const base = baseContentRef.current
      const finals = finalTranscriptRef.current
      const separator = base && finals ? ' ' : ''
      setContent(base + separator + finals + (finals && interim ? ' ' : '') + interim)
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted') setVoiceError(`Voice error: ${e.error}`)
      setListening(false)
    }

    rec.onend = () => {
      setListening(false)
      interimRef.current = ''
    }

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
      if (!res.ok) {
        setGdocError(json.error ?? 'Failed to import document')
        return
      }
      // Prepend or set content from doc
      const imported = json.content as string
      setContent(prev => prev ? `${prev}\n\n${imported}` : imported)
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
    const results: Attachment[] = []
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('program_id', currentProgram.id)
      const res = await fetch('/api/pulse/upload', { method: 'POST', body: fd })
      if (res.ok) {
        results.push(await res.json())
      }
    }
    setAttachments(prev => [...prev, ...results])
    setUploading(false)
    // Reset input so same file can be re-selected
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
      ? 'google_doc'
      : listening
      ? 'voice'
      : attachments.length > 0
      ? 'attachment'
      : 'typed'

    const res = await fetch('/api/pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program_id: currentProgram.id,
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
    if (res.ok || res.status === 204) {
      setNotes(prev => prev.filter(n => n.id !== id))
    }
  }

  // ---------------------------------------------------------------------------
  // Edit
  // ---------------------------------------------------------------------------

  function openEdit(note: PulseNote) {
    setEditNote(note)
    setEditContent(note.content)
    setEditDate(note.note_date)
  }

  async function handleEditSave() {
    if (!editNote) return
    setEditSaving(true)
    const res = await fetch(`/api/pulse/${editNote.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent.trim(), note_date: editDate }),
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
        {/* Compose panel */}
        <div className="w-[380px] flex-shrink-0 border-r border-zinc-200 bg-white flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <Label className="text-xs font-medium text-zinc-600 mb-1.5 block">Note date</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                <Input
                  type="date"
                  value={noteDate}
                  onChange={e => setNoteDate(e.target.value)}
                  className="pl-8 text-sm h-8"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-zinc-600 mb-1.5 block">Your note</Label>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={
                  listening
                    ? 'Listening… speak now'
                    : 'Write your field observation, or use voice / Google Doc import below…'
                }
                className={cn(
                  'min-h-[180px] resize-none text-sm leading-relaxed',
                  listening && 'ring-2 ring-red-400 ring-offset-1'
                )}
              />
              {/* Voice indicator */}
              {listening && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-red-500">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Recording… click mic to stop
                </div>
              )}
              {voiceError && (
                <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  {voiceError}
                </div>
              )}
            </div>

            {/* Tool row */}
            <div className="flex items-center gap-2">
              {hasSpeech && (
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  title={listening ? 'Stop recording' : 'Start voice input'}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    listening
                      ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  )}
                >
                  {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {listening ? 'Stop' : 'Voice'}
                </button>
              )}

              <button
                type="button"
                onClick={() => { setGdocOpen(true); setGdocError('') }}
                className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                <Link2 className="h-3.5 w-3.5" />
                Google Doc
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                Attach
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Pending attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((a, i) => (
                  <AttachmentChip
                    key={i}
                    attachment={a}
                    onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            )}

            {/* Google Doc source indicator */}
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
                <AlertCircle className="h-3.5 w-3.5" />
                {composeError}
              </div>
            )}
          </div>

          {/* Save button pinned to bottom */}
          <div className="border-t border-zinc-100 p-4">
            <Button
              onClick={handleSave}
              disabled={!content.trim() || saving}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Save Note
            </Button>
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto bg-zinc-50 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-400 text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notes…
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-3 rounded-full bg-orange-50 p-4">
                <ChevronDown className="h-6 w-6 text-orange-300" />
              </div>
              <p className="text-sm font-medium text-zinc-600">No notes yet</p>
              <p className="mt-1 text-xs text-zinc-400">
                Write your first field observation using the panel on the left.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {notes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Google Doc Import Dialog */}
      <Dialog open={gdocOpen} onOpenChange={open => { setGdocOpen(open); if (!open) { setGdocUrl(''); setGdocError('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import from Google Docs</DialogTitle>
            <DialogDescription>
              Paste the link to a Google Doc. The document must be shared with the service account email configured in your environment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              type="url"
              placeholder="https://docs.google.com/document/d/..."
              value={gdocUrl}
              onChange={e => setGdocUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGdocImport() }}
              autoFocus
            />
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
              <Button
                size="sm"
                onClick={handleGdocImport}
                disabled={gdocLoading || !gdocUrl.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {gdocLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editNote} onOpenChange={open => { if (!open) setEditNote(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs font-medium text-zinc-600 mb-1.5 block">Note date</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                <Input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="pl-8 text-sm h-8"
                />
              </div>
            </div>
            <Textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="min-h-[200px] resize-none text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditNote(null)}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEditSave}
                disabled={editSaving || !editContent.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {editSaving
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Check className="mr-1.5 h-3.5 w-3.5" />
                }
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
