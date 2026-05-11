'use client'

import { useEffect, useState } from 'react'
import { useProgram } from '@/contexts/program-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Save, Palette } from 'lucide-react'

const BRAND_PRESETS = [
  '#ea580c', '#16a34a', '#2563eb', '#9333ea',
  '#dc2626', '#0891b2', '#d97706', '#475569',
]

export function ProgramClient() {
  const { currentProgram, refetch } = useProgram()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [brandColor, setBrandColor] = useState('#ea580c')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!currentProgram) return
    setName(currentProgram.name)
    setSlug(currentProgram.slug)
    setDescription(currentProgram.description ?? '')
    setBrandColor(currentProgram.brand_color ?? '#ea580c')
    setDirty(false)
  }, [currentProgram])

  function mark() { setDirty(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!currentProgram) return
    setSaving(true)
    const res = await fetch(`/api/programs/${currentProgram.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, description: description || undefined, brand_color: brandColor }),
    })
    if (res.ok) {
      setDirty(false)
      toast.success('Program settings saved')
      await refetch()
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(typeof err.error === 'string' ? err.error : 'Failed to save')
    }
    setSaving(false)
  }

  if (!currentProgram) return null

  return (
    <div className="max-w-xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Program Settings</h1>
        <p className="mt-0.5 text-[14px] text-gray-500">Manage details for {currentProgram.name}</p>
      </div>

      <form onSubmit={save} className="space-y-5">
        <div>
          <label htmlFor="prog-name" className="text-[13px] font-medium text-gray-700 block mb-1.5">
            Program name <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <Input
            id="prog-name"
            value={name}
            onChange={e => { setName(e.target.value); mark() }}
            required
            className="h-9 text-[13px]"
            aria-required="true"
          />
        </div>

        <div>
          <label htmlFor="prog-slug" className="text-[13px] font-medium text-gray-700 block mb-1.5">
            Slug <span className="text-gray-400 font-normal">(used in form URLs)</span>
          </label>
          <div className="flex items-center gap-0">
            <span className="flex h-9 items-center rounded-l-md border border-r-0 border-gray-200 bg-gray-50 px-3 text-[12px] text-gray-400">/f/</span>
            <Input
              id="prog-slug"
              value={slug}
              onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); mark() }}
              className="h-9 text-[13px] rounded-l-none"
              pattern="[a-z0-9-]+"
              aria-describedby="slug-hint"
            />
          </div>
          <p id="slug-hint" className="mt-1 text-[11px] text-gray-400">Lowercase letters, numbers, and hyphens only.</p>
        </div>

        <div>
          <label htmlFor="prog-desc" className="text-[13px] font-medium text-gray-700 block mb-1.5">Description</label>
          <textarea
            id="prog-desc"
            value={description}
            onChange={e => { setDescription(e.target.value); mark() }}
            rows={3}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            placeholder="Brief description of this program…"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-gray-700 block mb-2">
            <Palette className="inline h-3.5 w-3.5 mr-1 text-gray-400" aria-hidden="true" />
            Brand color
          </label>
          <div className="flex items-center gap-3">
            <div className="flex gap-2 flex-wrap">
              {BRAND_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setBrandColor(c); mark() }}
                  className="h-7 w-7 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                  style={{
                    backgroundColor: c,
                    borderColor: brandColor === c ? '#111' : 'transparent',
                    transform: brandColor === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                  aria-label={`Set brand color to ${c}`}
                  aria-pressed={brandColor === c}
                />
              ))}
            </div>
            <input
              type="color"
              value={brandColor}
              onChange={e => { setBrandColor(e.target.value); mark() }}
              className="h-7 w-10 rounded border border-gray-200 cursor-pointer"
              aria-label="Custom brand color"
            />
            <span className="text-[12px] font-mono text-gray-500">{brandColor}</span>
          </div>
          <div className="mt-3 rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: brandColor + '18' }}>
            <div className="h-8 w-8 rounded-md flex items-center justify-center text-white text-[12px] font-bold" style={{ backgroundColor: brandColor }}>
              {name.slice(0, 2).toUpperCase() || 'EX'}
            </div>
            <span className="text-[13px] font-medium" style={{ color: brandColor }}>{name || 'Program name'}</span>
          </div>
        </div>

        <div className="pt-2 flex gap-3">
          <Button
            type="submit"
            className="h-9 gap-1.5 text-[13px] bg-orange-600 hover:bg-orange-700"
            disabled={saving || !dirty}
            aria-busy={saving}
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          {dirty && <p className="self-center text-[12px] text-gray-400">Unsaved changes</p>}
        </div>
      </form>
    </div>
  )
}
