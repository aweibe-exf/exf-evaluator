'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { useProgram } from '@/contexts/program-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  BarChart2,
  Loader2,
  Download,
  Save,
  Trash2,
  ChevronRight,
  ChevronLeft,
  BookmarkCheck,
  FileSpreadsheet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// Chart colors
// ---------------------------------------------------------------------------

const COLORS = [
  '#f97316', // orange-500
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#a855f7', // purple-500
  '#f43f5e', // rose-500
  '#eab308', // yellow-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
]

// ---------------------------------------------------------------------------
// Chart renderer
// ---------------------------------------------------------------------------

function ChartRenderer({ config, className }: { config: ChartConfig; className?: string }) {
  const seriesLabel = (key: string) => config.series_labels?.[key] ?? key

  if (config.chart_type === 'pie') {
    const key = config.y_keys[0]
    return (
      <ResponsiveContainer width="100%" height={340}>
        <PieChart>
          <Pie
            data={config.data}
            dataKey={key}
            nameKey={config.x_key}
            cx="50%"
            cy="50%"
            outerRadius={130}
            label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
          >
            {config.data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const commonProps = {
    data: config.data,
    margin: { top: 10, right: 20, left: 0, bottom: 5 },
  }

  const xAxis = (
    <XAxis
      dataKey={config.x_key}
      tick={{ fontSize: 12, fill: '#71717a' }}
      label={config.x_label ? { value: config.x_label, position: 'insideBottom', offset: -4, fontSize: 12, fill: '#a1a1aa' } : undefined}
    />
  )
  const yAxis = (
    <YAxis
      tick={{ fontSize: 12, fill: '#71717a' }}
      label={config.y_label ? { value: config.y_label, angle: -90, position: 'insideLeft', fontSize: 12, fill: '#a1a1aa' } : undefined}
    />
  )

  if (config.chart_type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={340} className={className}>
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          {xAxis}{yAxis}
          <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 6 }} />
          <Legend />
          {config.y_keys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} name={seriesLabel(k)} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (config.chart_type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={340} className={className}>
        <AreaChart {...commonProps}>
          <defs>
            {config.y_keys.map((k, i) => (
              <linearGradient key={k} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          {xAxis}{yAxis}
          <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 6 }} />
          <Legend />
          {config.y_keys.map((k, i) => (
            <Area key={k} type="monotone" dataKey={k} name={seriesLabel(k)} stroke={COLORS[i % COLORS.length]} fill={`url(#grad-${i})`} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // default: bar
  return (
    <ResponsiveContainer width="100%" height={340} className={className}>
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        {xAxis}{yAxis}
        <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 6 }} />
        <Legend />
        {config.y_keys.map((k, i) => (
          <Bar key={k} dataKey={k} name={seriesLabel(k)} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function exportCSV(config: ChartConfig) {
  const headers = [config.x_key, ...config.y_keys]
  const rows = config.data.map(row =>
    headers.map(h => {
      const v = row[h]
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v ?? '')
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${config.title.replace(/\s+/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function exportPNG(svgEl: SVGSVGElement | null, title: string) {
  if (!svgEl) return
  const svgStr = new XMLSerializer().serializeToString(svgEl)
  const img = new Image()
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  img.src = url
  await new Promise(r => { img.onload = r })
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = svgEl.clientWidth * scale
  canvas.height = svgEl.clientHeight * scale
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#18181b'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)
  canvas.toBlob(pngBlob => {
    if (!pngBlob) return
    const pngUrl = URL.createObjectURL(pngBlob)
    const a = document.createElement('a')
    a.href = pngUrl
    a.download = `${title.replace(/\s+/g, '_')}.png`
    a.click()
    URL.revokeObjectURL(pngUrl)
  }, 'image/png')
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VisualizerClient() {
  const { currentProgram } = useProgram()

  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<ChartConfig | null>(null)
  const [lastPrompt, setLastPrompt] = useState('')

  // Saved visualizations
  const [saved, setSaved] = useState<SavedViz[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Save dialog
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [saving, setSaving] = useState(false)

  // Chart SVG ref for PNG export
  const chartWrapRef = useRef<HTMLDivElement>(null)

  const programId = currentProgram?.id

  // Load saved visualizations
  const loadSaved = useCallback(async () => {
    if (!programId) return
    setSavedLoading(true)
    try {
      const res = await fetch(`/api/visualizations?program_id=${programId}`)
      if (res.ok) setSaved(await res.json())
    } finally {
      setSavedLoading(false)
    }
  }, [programId])

  useEffect(() => { loadSaved() }, [loadSaved])

  // Generate chart
  async function handleGenerate() {
    if (!programId || !prompt.trim()) return
    setLoading(true)
    setError(null)
    setConfig(null)
    try {
      const res = await fetch('/api/ai/visualizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId, prompt: prompt.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate visualization')
      setConfig(json.config as ChartConfig)
      setLastPrompt(json.prompt)
      setSaveTitle(json.config.title ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Save visualization
  async function handleSave() {
    if (!programId || !config) return
    setSaving(true)
    try {
      const res = await fetch('/api/visualizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: programId,
          title: saveTitle.trim() || config.title,
          description: config.description,
          prompt: lastPrompt,
          config,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaveOpen(false)
      await loadSaved()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Delete saved viz
  async function handleDelete(id: string) {
    if (!confirm('Delete this saved visualization?')) return
    await fetch(`/api/visualizations/${id}`, { method: 'DELETE' })
    setSaved(prev => prev.filter(v => v.id !== id))
  }

  // Load a saved viz into the viewer
  function loadSavedViz(viz: SavedViz) {
    setConfig(viz.config)
    setLastPrompt(viz.prompt)
    setPrompt(viz.prompt)
    setSaveTitle(viz.title)
  }

  // PNG export
  function handleExportPNG() {
    const svg = chartWrapRef.current?.querySelector('svg') as SVGSVGElement | null
    exportPNG(svg, config?.title ?? 'chart')
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Saved sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200 shrink-0',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden border-r-0'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-sm font-semibold text-zinc-200">Saved Charts</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500" onClick={() => setSidebarOpen(false)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {savedLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            </div>
          ) : saved.length === 0 ? (
            <p className="text-center text-xs text-zinc-600 py-8">No saved charts yet</p>
          ) : saved.map(viz => (
            <div
              key={viz.id}
              className="group rounded-md p-2.5 hover:bg-zinc-800 cursor-pointer transition-colors"
              onClick={() => loadSavedViz(viz)}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">{viz.title}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{viz.prompt}</p>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    {viz.created_by_email?.split('@')[0]} · {new Date(viz.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(viz.id) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-600 hover:text-red-400 transition-opacity flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 -ml-1" onClick={() => setSidebarOpen(true)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          <BarChart2 className="h-5 w-5 text-orange-500 flex-shrink-0" />
          <div>
            <h1 className="text-base font-semibold text-zinc-100">Data Visualizer</h1>
            <p className="text-xs text-zinc-500">Ask a question about your data and get an interactive chart</p>
          </div>
        </div>

        {/* Prompt area */}
        <div className="border-b border-zinc-800 px-6 py-4 space-y-3">
          <Textarea
            placeholder="e.g. Show the growth of submissions over the past 6 months, or Compare average scores across all forms"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            rows={2}
            className="resize-none bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-orange-500"
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || !programId}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart2 className="mr-2 h-4 w-4" />}
              {loading ? 'Generating…' : 'Generate Chart'}
            </Button>
            <span className="text-xs text-zinc-600">⌘+Enter</span>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Chart area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!config ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-20">
              <BarChart2 className="h-12 w-12 text-zinc-700" />
              <p className="text-sm text-zinc-500 max-w-sm">
                Describe the chart you want to see and click Generate. You can ask about trends, comparisons, distributions, and more.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-left max-w-sm w-full">
                {[
                  'Show submission counts by month',
                  'Compare average scores across all forms',
                  'What percentage of applicants selected each option on the main form?',
                  'Show me the growth trend over the past year',
                ].map(ex => (
                  <button
                    key={ex}
                    onClick={() => setPrompt(ex)}
                    className="text-left text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-900 hover:bg-zinc-800 rounded px-3 py-2 transition-colors border border-zinc-800"
                  >
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {/* Chart header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">{config.title}</h2>
                  <p className="text-sm text-zinc-400 mt-0.5">{config.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    onClick={() => exportCSV(config)}
                  >
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    onClick={handleExportPNG}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    PNG
                  </Button>
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => { setSaveTitle(config.title); setSaveOpen(true) }}
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save
                  </Button>
                </div>
              </div>

              {/* Chart */}
              <div ref={chartWrapRef} className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <ChartRenderer config={config} />
              </div>

              {/* Data table */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 select-none">
                  <ChevronRight className="h-3.5 w-3.5 group-open:rotate-90 transition-transform" />
                  View raw data ({config.data.length} rows)
                </summary>
                <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-900 text-zinc-400">
                      <tr>
                        {[config.x_key, ...config.y_keys].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {config.data.map((row, i) => (
                        <tr key={i} className="hover:bg-zinc-900/50">
                          {[config.x_key, ...config.y_keys].map(h => (
                            <td key={h} className="px-3 py-2 text-zinc-300">{String(row[h] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkCheck className="h-4 w-4 text-orange-500" />
              Save Visualization
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Title</label>
              <Input
                value={saveTitle}
                onChange={e => setSaveTitle(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
                placeholder="Chart title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)} className="text-zinc-400">Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !saveTitle.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
