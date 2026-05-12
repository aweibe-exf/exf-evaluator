'use client'

import { useEffect, useState, useMemo } from 'react'
import { useProgram } from '@/contexts/program-context'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText, Image, Download, Search, ArrowUpDown,
  ArrowUp, ArrowDown, FileQuestion,
  User, StickyNote, FolderOpen, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawAttachment {
  name: string
  url: string
  size: number
  type: string
  extracted_text?: string | null
}

interface PulseNote {
  id: string
  title: string | null
  note_date: string
  author_email: string | null
  attachments: RawAttachment[]
}

interface FileRow {
  key: string          // `${noteId}-${i}`
  name: string
  url: string
  size: number
  mimeType: string
  hasText: boolean
  noteId: string
  attachmentIndex: number
  noteTitle: string | null
  noteDate: string
  authorEmail: string | null
}

type SortKey = 'date' | 'name' | 'size' | 'author'
type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500 flex-shrink-0" aria-hidden="true" />
  if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500 flex-shrink-0" aria-hidden="true" />
  return <FileQuestion className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
}

function fileTypeLabel(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType === 'image/png') return 'PNG'
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'JPG'
  if (mimeType === 'image/gif') return 'GIF'
  if (mimeType === 'image/webp') return 'WebP'
  return mimeType.split('/')[1]?.toUpperCase() ?? 'File'
}

function SortButton({
  label, sortKey, current, dir, onClick,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onClick: () => void
}) {
  const active = current === sortKey
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide transition-colors',
        active ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'
      )}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {active
        ? dir === 'asc'
          ? <ArrowUp className="h-3 w-3" aria-hidden="true" />
          : <ArrowDown className="h-3 w-3" aria-hidden="true" />
        : <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
      }
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FilesClient() {
  const { currentProgram, currentRole } = useProgram()
  const [files, setFiles] = useState<FileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'image'>('all')
  const [extracting, setExtracting] = useState<string | null>(null) // file.key

  const isAdmin = currentRole && ['super_admin', 'program_admin'].includes(currentRole)

  useEffect(() => {
    if (!currentProgram) return
    setLoading(true)
    fetch(`/api/pulse?program_id=${currentProgram.id}`)
      .then(r => r.ok ? r.json() : [])
      .then((notes: PulseNote[]) => {
        const rows: FileRow[] = []
        for (const note of notes) {
          const attachments = note.attachments ?? []
          for (let i = 0; i < attachments.length; i++) {
            const a = attachments[i]
            if (!a?.url) continue
            rows.push({
              key: `${note.id}-${i}`,
              name: a.name,
              url: a.url,
              size: a.size ?? 0,
              mimeType: a.type ?? '',
              hasText: !!a.extracted_text,
              noteId: note.id,
              attachmentIndex: i,
              noteTitle: note.title,
              noteDate: note.note_date,
              authorEmail: note.author_email,
            })
          }
        }
        setFiles(rows)
      })
      .finally(() => setLoading(false))
  }, [currentProgram])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return files
      .filter(f => {
        if (typeFilter === 'pdf') return f.mimeType === 'application/pdf'
        if (typeFilter === 'image') return f.mimeType.startsWith('image/')
        return true
      })
      .filter(f =>
        !q ||
        f.name.toLowerCase().includes(q) ||
        (f.noteTitle ?? '').toLowerCase().includes(q) ||
        (f.authorEmail ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'date') cmp = a.noteDate.localeCompare(b.noteDate)
        else if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
        else if (sortKey === 'size') cmp = a.size - b.size
        else if (sortKey === 'author') cmp = (a.authorEmail ?? '').localeCompare(b.authorEmail ?? '')
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [files, search, typeFilter, sortKey, sortDir])

  async function handleReextract(file: FileRow) {
    setExtracting(file.key)
    try {
      const res = await fetch('/api/pulse/reextract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: file.noteId, attachment_index: file.attachmentIndex }),
      })
      if (res.ok) {
        setFiles(prev => prev.map(f => f.key === file.key ? { ...f, hasText: true } : f))
        toast.success('Text extracted successfully — Sidekick can now read this PDF')
      } else {
        const j = await res.json()
        toast.error(j.error ?? 'Extraction failed')
      }
    } catch {
      toast.error('Network error during extraction')
    }
    setExtracting(null)
  }

  if (!isAdmin) {
    return (
      <div className="max-w-5xl px-8 py-8">
        <p className="text-[14px] text-gray-500">You don't have permission to view the file repository.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Files</h1>
        <p className="mt-0.5 text-[14px] text-gray-500">
          All attachments uploaded via Pulse field notes for {currentProgram?.name ?? 'this program'}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <Input
            placeholder="Search files, notes, authors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-[13px]"
            aria-label="Search files"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(['all', 'pdf', 'image'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-medium capitalize transition-colors',
                typeFilter === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
              )}
              aria-pressed={typeFilter === t}
            >
              {t === 'all' ? 'All types' : t.toUpperCase()}
            </button>
          ))}
        </div>

        <span className="text-[13px] text-gray-400 ml-auto">
          {filtered.length} file{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-gray-200 mb-3" aria-hidden="true" />
          <p className="text-[14px] font-medium text-gray-500">
            {search || typeFilter !== 'all' ? 'No files match your search' : 'No files uploaded yet'}
          </p>
          {!search && typeFilter === 'all' && (
            <p className="text-[12px] text-gray-400 mt-1">
              Files attached to Pulse field notes will appear here.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50">
            <SortButton label="File" sortKey="name" current={sortKey} dir={sortDir} onClick={() => toggleSort('name')} />
            <SortButton label="Date" sortKey="date" current={sortKey} dir={sortDir} onClick={() => toggleSort('date')} />
            <SortButton label="Author" sortKey="author" current={sortKey} dir={sortDir} onClick={() => toggleSort('author')} />
            <SortButton label="Size" sortKey="size" current={sortKey} dir={sortDir} onClick={() => toggleSort('size')} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-8" />
          </div>

          {/* Rows */}
          {filtered.map((file, i) => (
            <div
              key={file.key}
              className={cn(
                'grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors',
                i < filtered.length - 1 && 'border-b border-gray-50'
              )}
            >
              {/* File name + source note */}
              <div className="flex items-center gap-2.5 min-w-0">
                {fileIcon(file.mimeType)}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                      {fileTypeLabel(file.mimeType)}
                    </span>
                    {file.hasText && (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">
                        Text extracted
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-gray-400 truncate">
                      <StickyNote className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{file.noteTitle ?? 'Untitled note'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Date */}
              <div className="min-w-0">
                <p className="text-[13px] text-gray-700">
                  {format(new Date(file.noteDate), 'MMM d, yyyy')}
                </p>
                <p className="text-[11px] text-gray-400">
                  {formatDistanceToNow(new Date(file.noteDate), { addSuffix: true })}
                </p>
              </div>

              {/* Author */}
              <div className="flex items-center gap-1.5 min-w-0">
                <User className="h-3 w-3 text-gray-300 flex-shrink-0" aria-hidden="true" />
                <span className="text-[13px] text-gray-600 truncate" title={file.authorEmail ?? undefined}>
                  {file.authorEmail ? file.authorEmail.split('@')[0] : '—'}
                </span>
              </div>

              {/* Size */}
              <div>
                <span className="text-[13px] text-gray-600">{formatBytes(file.size)}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {file.mimeType === 'application/pdf' && !file.hasText && (
                  <button
                    onClick={() => handleReextract(file)}
                    disabled={extracting === file.key}
                    title="Extract text so Sidekick can read this PDF"
                    className="flex items-center justify-center h-7 w-7 rounded-md text-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
                    aria-label={`Extract text from ${file.name}`}
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', extracting === file.key && 'animate-spin')} aria-hidden="true" />
                  </button>
                )}
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={file.name}
                  className="flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                  aria-label={`Download ${file.name}`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
