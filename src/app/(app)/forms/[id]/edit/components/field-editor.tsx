'use client'

import { nanoid } from 'nanoid'
import { Trash2, Plus, GripVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LogicEditor } from './logic-editor'
import type { FormField, FormPage, FieldOption } from '@/types/forms'

interface Props {
  field: FormField | null
  allFields: FormField[]
  allPages: FormPage[]
  onUpdate: (updates: Partial<FormField>) => void
  onDelete: () => void
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[12px] font-medium text-gray-600 block mb-1">
      {children}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 px-4 py-3 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{title}</p>
      {children}
    </div>
  )
}

function ToggleRow({ id, label, description, checked, onCheckedChange }: {
  id: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <label htmlFor={id} className="text-[13px] font-medium text-gray-700 cursor-pointer">{label}</label>
        {description && <p className="text-[11px] text-gray-400">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  )
}

function OptionsEditor({ options = [], onChange }: {
  options: FieldOption[]
  onChange: (opts: FieldOption[]) => void
}) {
  function addOption() {
    const n = options.length + 1
    onChange([...options, { id: nanoid(), label: `Option ${n}`, value: `option_${n}` }])
  }

  function updateOption(id: string, label: string) {
    onChange(options.map(o => o.id === id ? { ...o, label, value: label.toLowerCase().replace(/\s+/g, '_') } : o))
  }

  function removeOption(id: string) {
    onChange(options.filter(o => o.id !== id))
  }

  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-1.5">
          <GripVertical className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" aria-hidden="true" />
          <Input
            value={opt.label}
            onChange={e => updateOption(opt.id, e.target.value)}
            className="h-7 text-[12px] flex-1"
            aria-label={`Option ${i + 1} label`}
          />
          <button
            onClick={() => removeOption(opt.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
            aria-label={`Remove option ${opt.label}`}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        onClick={addOption}
        className="flex items-center gap-1 text-[12px] text-orange-600 hover:text-orange-700 transition-colors focus:outline-none focus-visible:underline"
        aria-label="Add option"
      >
        <Plus className="h-3 w-3" aria-hidden="true" /> Add option
      </button>
    </div>
  )
}

function MatrixEditor({ field, onUpdate }: { field: FormField; onUpdate: (u: Partial<FormField>) => void }) {
  const rows = field.matrixRows ?? []
  const cols = field.matrixColumns ?? []

  function addRow() {
    onUpdate({ matrixRows: [...rows, { id: nanoid(), label: `Row ${rows.length + 1}` }] })
  }
  function addCol() {
    onUpdate({ matrixColumns: [...cols, { id: nanoid(), label: `Col ${cols.length + 1}` }] })
  }
  function updateRow(id: string, label: string) {
    onUpdate({ matrixRows: rows.map(r => r.id === id ? { ...r, label } : r) })
  }
  function updateCol(id: string, label: string) {
    onUpdate({ matrixColumns: cols.map(c => c.id === id ? { ...c, label } : c) })
  }
  function removeRow(id: string) { onUpdate({ matrixRows: rows.filter(r => r.id !== id) }) }
  function removeCol(id: string) { onUpdate({ matrixColumns: cols.filter(c => c.id !== id) }) }

  return (
    <div className="space-y-3">
      <div>
        <Label>Rows</Label>
        <div className="space-y-1">
          {rows.map((r, i) => (
            <div key={r.id} className="flex items-center gap-1.5">
              <Input value={r.label} onChange={e => updateRow(r.id, e.target.value)} className="h-7 text-[12px] flex-1" aria-label={`Row ${i + 1}`} />
              <button onClick={() => removeRow(r.id)} className="p-1 text-gray-400 hover:text-red-500 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400" aria-label={`Remove row ${r.label}`}>
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button onClick={addRow} className="flex items-center gap-1 text-[12px] text-orange-600 hover:text-orange-700 focus:outline-none focus-visible:underline" aria-label="Add row">
            <Plus className="h-3 w-3" aria-hidden="true" /> Add row
          </button>
        </div>
      </div>
      <div>
        <Label>Columns</Label>
        <div className="space-y-1">
          {cols.map((c, i) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <Input value={c.label} onChange={e => updateCol(c.id, e.target.value)} className="h-7 text-[12px] flex-1" aria-label={`Column ${i + 1}`} />
              <button onClick={() => removeCol(c.id)} className="p-1 text-gray-400 hover:text-red-500 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400" aria-label={`Remove column ${c.label}`}>
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button onClick={addCol} className="flex items-center gap-1 text-[12px] text-orange-600 hover:text-orange-700 focus:outline-none focus-visible:underline" aria-label="Add column">
            <Plus className="h-3 w-3" aria-hidden="true" /> Add column
          </button>
        </div>
      </div>
      <div>
        <Label htmlFor="matrix-type">Cell type</Label>
        <Select value={field.matrixType ?? 'radio'} onValueChange={v => onUpdate({ matrixType: v as 'radio' | 'checkbox' })}>
          <SelectTrigger id="matrix-type" className="h-8 text-[12px]" aria-label="Matrix cell type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="radio">Radio (single per row)</SelectItem>
            <SelectItem value="checkbox">Checkbox (multiple per row)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function FieldEditor({ field, allFields, allPages, onUpdate, onDelete }: Props) {
  if (!field) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center px-6">
        <p className="text-[13px] text-gray-400 font-medium">No field selected</p>
        <p className="text-[12px] text-gray-300 mt-1">Click a field on the canvas to edit it</p>
      </div>
    )
  }

  const isLayout = ['section_header', 'instructional_text', 'spacer'].includes(field.type)
  const hasOptions = ['single_choice', 'multiple_choice', 'dropdown'].includes(field.type)
  const hasScale = ['rating', 'likert_scale', 'nps', 'slider'].includes(field.type)

  return (
    <div>
      {/* Basic section */}
      <div className="px-4 py-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          {field.type.replace(/_/g, ' ')}
        </p>

        {field.type !== 'spacer' && (
          <div>
            <Label htmlFor="field-label">
              {isLayout ? 'Title' : 'Question label'}
            </Label>
            <Input
              id="field-label"
              value={field.label}
              onChange={e => onUpdate({ label: e.target.value })}
              placeholder={isLayout ? 'Section title' : 'Enter your question'}
              className="h-8 text-[13px]"
              aria-label="Field label"
            />
          </div>
        )}

        {(field.type === 'section_header' || field.type === 'instructional_text') && (
          <div>
            <Label htmlFor="field-content">
              {field.type === 'section_header' ? 'Subtitle (optional)' : 'Content'}
            </Label>
            <Textarea
              id="field-content"
              value={field.content ?? ''}
              onChange={e => onUpdate({ content: e.target.value })}
              placeholder={field.type === 'section_header' ? 'Optional description…' : 'Enter instructions…'}
              className="text-[13px] min-h-[60px]"
              aria-label={field.type === 'section_header' ? 'Section subtitle' : 'Instructional content'}
            />
          </div>
        )}

        {!isLayout && (
          <>
            <div>
              <Label htmlFor="field-placeholder">Placeholder</Label>
              <Input
                id="field-placeholder"
                value={field.placeholder ?? ''}
                onChange={e => onUpdate({ placeholder: e.target.value })}
                placeholder="Placeholder text…"
                className="h-8 text-[13px]"
                aria-label="Placeholder text"
              />
            </div>
            <div>
              <Label htmlFor="field-help">Help text</Label>
              <Input
                id="field-help"
                value={field.helpText ?? ''}
                onChange={e => onUpdate({ helpText: e.target.value })}
                placeholder="Additional guidance…"
                className="h-8 text-[13px]"
                aria-label="Help text"
              />
            </div>
          </>
        )}
      </div>

      {/* Options */}
      {hasOptions && (
        <Section title="Options">
          <OptionsEditor
            options={field.options ?? []}
            onChange={opts => onUpdate({ options: opts })}
          />
        </Section>
      )}

      {/* Scale settings */}
      {hasScale && (
        <Section title="Scale">
          {field.type === 'rating' && (
            <div>
              <Label htmlFor="rating-max">Number of stars</Label>
              <Select value={String(field.max ?? 5)} onValueChange={v => onUpdate({ max: Number(v) })}>
                <SelectTrigger id="rating-max" className="h-8 text-[12px]" aria-label="Number of rating stars">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} stars</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {field.type === 'likert_scale' && (
            <>
              <div>
                <Label htmlFor="likert-points">Points</Label>
                <Select value={String(field.scale ?? 5)} onValueChange={v => onUpdate({ scale: Number(v) })}>
                  <SelectTrigger id="likert-points" className="h-8 text-[12px]" aria-label="Likert scale points">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 4, 5, 6, 7].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} points</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="likert-start">Start label</Label>
                <Input
                  id="likert-start"
                  value={field.scaleLabels?.start ?? ''}
                  onChange={e => onUpdate({ scaleLabels: { ...field.scaleLabels, start: e.target.value } })}
                  className="h-8 text-[12px]"
                  placeholder="e.g. Strongly disagree"
                  aria-label="Likert scale start label"
                />
              </div>
              <div>
                <Label htmlFor="likert-end">End label</Label>
                <Input
                  id="likert-end"
                  value={field.scaleLabels?.end ?? ''}
                  onChange={e => onUpdate({ scaleLabels: { ...field.scaleLabels, end: e.target.value } })}
                  className="h-8 text-[12px]"
                  placeholder="e.g. Strongly agree"
                  aria-label="Likert scale end label"
                />
              </div>
            </>
          )}
          {field.type === 'slider' && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="slider-min">Min</Label>
                <Input id="slider-min" type="number" value={field.min ?? 0} onChange={e => onUpdate({ min: Number(e.target.value) })} className="h-8 text-[12px]" aria-label="Slider minimum value" />
              </div>
              <div>
                <Label htmlFor="slider-max">Max</Label>
                <Input id="slider-max" type="number" value={field.max ?? 100} onChange={e => onUpdate({ max: Number(e.target.value) })} className="h-8 text-[12px]" aria-label="Slider maximum value" />
              </div>
              <div>
                <Label htmlFor="slider-step">Step</Label>
                <Input id="slider-step" type="number" value={field.step ?? 1} onChange={e => onUpdate({ step: Number(e.target.value) })} className="h-8 text-[12px]" aria-label="Slider step value" />
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Matrix */}
      {field.type === 'matrix' && (
        <Section title="Matrix">
          <MatrixEditor field={field} onUpdate={onUpdate} />
        </Section>
      )}

      {/* Hidden field */}
      {field.type === 'hidden_field' && (
        <Section title="Token mapping">
          <div>
            <Label htmlFor="metadata-key">Metadata key</Label>
            <Input
              id="metadata-key"
              value={field.metadataKey ?? ''}
              onChange={e => onUpdate({ metadataKey: e.target.value })}
              placeholder="e.g. organization"
              className="h-8 text-[12px]"
              aria-label="Token metadata key"
            />
            <p className="text-[11px] text-gray-400 mt-1">Pre-filled from token metadata when the form is sent via email link</p>
          </div>
        </Section>
      )}

      {/* Calculated field */}
      {field.type === 'calculated_field' && (
        <Section title="Formula">
          <div>
            <Label htmlFor="formula">Formula</Label>
            <Textarea
              id="formula"
              value={field.formula ?? ''}
              onChange={e => onUpdate({ formula: e.target.value })}
              placeholder="e.g. {field_a} + {field_b}"
              className="text-[12px] font-mono min-h-[60px]"
              aria-label="Calculation formula"
            />
            <p className="text-[11px] text-gray-400 mt-1">Reference other fields using their ID in curly braces</p>
          </div>
        </Section>
      )}

      {/* Validation toggles */}
      {!isLayout && (
        <Section title="Validation">
          <ToggleRow
            id="field-required"
            label="Required"
            description="Respondent must answer this field"
            checked={field.required}
            onCheckedChange={v => onUpdate({ required: v })}
          />
          <ToggleRow
            id="field-hidden"
            label="Hidden"
            description="Not shown to respondent"
            checked={field.hidden}
            onCheckedChange={v => onUpdate({ hidden: v })}
          />
        </Section>
      )}

      {/* Conditional logic */}
      {!isLayout && (
        <Section title="Conditional logic">
          <LogicEditor
            field={field}
            allFields={allFields}
            allPages={allPages}
            onUpdate={onUpdate}
          />
        </Section>
      )}

      {/* Delete */}
      <div className="px-4 py-3 border-t border-gray-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 text-[12px] gap-1.5"
          aria-label="Delete this field"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete field
        </Button>
      </div>
    </div>
  )
}
