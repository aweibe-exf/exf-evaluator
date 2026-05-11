'use client'

import { nanoid } from 'nanoid'
import type { FieldType, FormField } from '@/types/forms'

interface FieldTypeConfig {
  type: FieldType
  label: string
  icon: string
  description: string
}

const FIELD_GROUPS: { label: string; fields: FieldTypeConfig[] }[] = [
  {
    label: 'Input',
    fields: [
      { type: 'short_text',  label: 'Short text',  icon: 'T',  description: 'Single line text' },
      { type: 'long_text',   label: 'Long text',   icon: '¶',  description: 'Multi-line text area' },
      { type: 'number',      label: 'Number',      icon: '#',  description: 'Numeric input' },
      { type: 'email',       label: 'Email',       icon: '@',  description: 'Email address' },
      { type: 'url',         label: 'URL',         icon: '🔗', description: 'Website URL' },
      { type: 'date',        label: 'Date',        icon: '📅', description: 'Date picker' },
      { type: 'file_upload', label: 'File upload', icon: '📎', description: 'File attachment' },
    ],
  },
  {
    label: 'Choice',
    fields: [
      { type: 'single_choice',   label: 'Single choice',   icon: '◉', description: 'Radio buttons' },
      { type: 'multiple_choice', label: 'Multiple choice', icon: '☑', description: 'Checkboxes' },
      { type: 'dropdown',        label: 'Dropdown',        icon: '▾', description: 'Select menu' },
    ],
  },
  {
    label: 'Scale',
    fields: [
      { type: 'rating',       label: 'Rating',      icon: '★', description: 'Star or number rating' },
      { type: 'likert_scale', label: 'Likert scale', icon: '⇔', description: 'Agreement scale' },
      { type: 'nps',          label: 'NPS',         icon: '📊', description: 'Net Promoter Score' },
      { type: 'slider',       label: 'Slider',      icon: '⊢', description: 'Range slider' },
    ],
  },
  {
    label: 'Matrix',
    fields: [
      { type: 'matrix', label: 'Matrix / Grid', icon: '⊞', description: 'Rows × columns grid' },
    ],
  },
  {
    label: 'Layout',
    fields: [
      { type: 'section_header',    label: 'Section header',    icon: 'H', description: 'Heading divider' },
      { type: 'instructional_text', label: 'Instructional text', icon: 'i', description: 'Read-only text block' },
      { type: 'spacer',            label: 'Spacer',            icon: '↕', description: 'Vertical spacing' },
    ],
  },
  {
    label: 'Advanced',
    fields: [
      { type: 'hidden_field',     label: 'Hidden field',    icon: '👁', description: 'Pre-filled from token' },
      { type: 'calculated_field', label: 'Calculated field', icon: 'ƒ', description: 'Formula-based value' },
      { type: 'signature',        label: 'Signature',       icon: '✍', description: 'Signature capture' },
    ],
  },
]

function makeDefaultField(type: FieldType): FormField {
  const base: FormField = {
    id: nanoid(),
    type,
    label: '',
    required: false,
    hidden: false,
  }

  switch (type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'dropdown':
      return { ...base, options: [
        { id: nanoid(), label: 'Option 1', value: 'option_1' },
        { id: nanoid(), label: 'Option 2', value: 'option_2' },
      ]}
    case 'rating':
      return { ...base, max: 5, label: 'Rating' }
    case 'likert_scale':
      return { ...base, scale: 5, scaleLabels: { start: 'Strongly disagree', end: 'Strongly agree' } }
    case 'nps':
      return { ...base, label: 'How likely are you to recommend this program?', min: 0, max: 10 }
    case 'slider':
      return { ...base, min: 0, max: 100, step: 1 }
    case 'matrix':
      return {
        ...base,
        matrixRows: [{ id: nanoid(), label: 'Row 1' }, { id: nanoid(), label: 'Row 2' }],
        matrixColumns: [{ id: nanoid(), label: 'Col 1' }, { id: nanoid(), label: 'Col 2' }, { id: nanoid(), label: 'Col 3' }],
        matrixType: 'radio',
      }
    case 'section_header':
      return { ...base, label: 'Section title', content: '', required: false }
    case 'instructional_text':
      return { ...base, label: '', content: 'Enter instructions here.', required: false }
    default:
      return base
  }
}

interface Props {
  onAddField: (field: FormField) => void
}

export function FieldPalette({ onAddField }: Props) {
  return (
    <div className="py-3">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        Add field
      </p>
      {FIELD_GROUPS.map(group => (
        <div key={group.label} className="mb-1">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {group.label}
          </p>
          {group.fields.map(cfg => (
            <button
              key={cfg.type}
              onClick={() => {
                const field = makeDefaultField(cfg.type)
                field.label = cfg.type === 'section_header' || cfg.type === 'instructional_text'
                  ? field.label
                  : cfg.label
                onAddField(field)
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-gray-50 transition-colors group focus:outline-none focus-visible:bg-orange-50"
              title={cfg.description}
              aria-label={`Add ${cfg.label} field`}
            >
              <span
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-[11px] text-gray-500 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors"
                aria-hidden="true"
              >
                {cfg.icon}
              </span>
              <span className="text-[12px] font-medium text-gray-700 group-hover:text-gray-900">
                {cfg.label}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export { makeDefaultField }
