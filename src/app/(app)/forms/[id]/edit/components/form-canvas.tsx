'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Copy, MoveRight } from 'lucide-react'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils'
import type { FormPage, FormField } from '@/types/forms'

const FIELD_TYPE_LABELS: Record<string, string> = {
  short_text: 'Short text', long_text: 'Long text', number: 'Number',
  email: 'Email', url: 'URL', date: 'Date', file_upload: 'File upload',
  single_choice: 'Single choice', multiple_choice: 'Multiple choice', dropdown: 'Dropdown',
  rating: 'Rating', likert_scale: 'Likert scale', nps: 'NPS', slider: 'Slider',
  matrix: 'Matrix', section_header: 'Section header', instructional_text: 'Instructional text',
  spacer: 'Spacer', hidden_field: 'Hidden field', calculated_field: 'Calculated field', signature: 'Signature',
}

function FieldPreview({ field }: { field: FormField }) {
  const isLayout = ['section_header', 'instructional_text', 'spacer'].includes(field.type)

  if (field.type === 'section_header') {
    return (
      <div>
        <h3 className="text-[15px] font-semibold text-gray-800">{field.label || 'Section header'}</h3>
        {field.content && <p className="text-[13px] text-gray-500 mt-0.5">{field.content}</p>}
        <div className="mt-2 border-b border-gray-200" />
      </div>
    )
  }

  if (field.type === 'instructional_text') {
    return <p className="text-[13px] text-gray-600">{field.content || 'Instructional text'}</p>
  }

  if (field.type === 'spacer') {
    return <div className="h-4" aria-label="Spacer" />
  }

  return (
    <div>
      <div className="flex items-baseline gap-1 mb-1.5">
        <label className="text-[13px] font-medium text-gray-700">
          {field.label || <span className="italic text-gray-400">{FIELD_TYPE_LABELS[field.type] ?? field.type}</span>}
        </label>
        {field.required && <span className="text-red-500 text-[11px]" aria-hidden="true">*</span>}
      </div>
      {field.helpText && <p className="text-[11px] text-gray-400 mb-1">{field.helpText}</p>}

      {/* Field-type-specific preview */}
      {(field.type === 'short_text' || field.type === 'email' || field.type === 'url' || field.type === 'number' || field.type === 'date') && (
        <div className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2.5 flex items-center">
          <span className="text-[12px] text-gray-400">{field.placeholder || 'Your answer…'}</span>
        </div>
      )}

      {field.type === 'long_text' && (
        <div className="h-16 rounded-md border border-gray-200 bg-gray-50 px-2.5 pt-1.5">
          <span className="text-[12px] text-gray-400">{field.placeholder || 'Your answer…'}</span>
        </div>
      )}

      {(field.type === 'single_choice' || field.type === 'multiple_choice') && (
        <div className="space-y-1">
          {(field.options ?? []).slice(0, 3).map(opt => (
            <div key={opt.id} className="flex items-center gap-2">
              <div className={cn(
                'h-3.5 w-3.5 flex-shrink-0 border border-gray-300 bg-white',
                field.type === 'single_choice' ? 'rounded-full' : 'rounded-sm'
              )} aria-hidden="true" />
              <span className="text-[12px] text-gray-600">{opt.label}</span>
            </div>
          ))}
          {(field.options?.length ?? 0) > 3 && (
            <span className="text-[11px] text-gray-400">+{(field.options?.length ?? 0) - 3} more</span>
          )}
        </div>
      )}

      {field.type === 'dropdown' && (
        <div className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2.5 flex items-center justify-between">
          <span className="text-[12px] text-gray-400">Select an option…</span>
          <span className="text-gray-400 text-[10px]" aria-hidden="true">▾</span>
        </div>
      )}

      {field.type === 'rating' && (
        <div className="flex gap-1">
          {[...Array(field.max ?? 5)].map((_, i) => (
            <span key={i} className="text-[18px] text-gray-200" aria-hidden="true">★</span>
          ))}
        </div>
      )}

      {field.type === 'likert_scale' && (
        <div>
          <div className="flex gap-1.5 mb-1">
            {[...Array(field.scale ?? 5)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-5 w-5 rounded-full border border-gray-200 bg-gray-50" aria-hidden="true" />
                <span className="text-[10px] text-gray-400">{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-gray-400">{field.scaleLabels?.start}</span>
            <span className="text-[10px] text-gray-400">{field.scaleLabels?.end}</span>
          </div>
        </div>
      )}

      {field.type === 'nps' && (
        <div className="flex gap-1">
          {[...Array(11)].map((_, i) => (
            <div key={i} className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-gray-50 text-[11px] text-gray-500" aria-hidden="true">
              {i}
            </div>
          ))}
        </div>
      )}

      {field.type === 'slider' && (
        <div className="pt-1">
          <div className="h-1.5 rounded-full bg-gray-200 relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-orange-500 bg-white shadow" aria-hidden="true" />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-400">{field.min ?? 0}</span>
            <span className="text-[10px] text-gray-400">{field.max ?? 100}</span>
          </div>
        </div>
      )}

      {field.type === 'matrix' && (
        <div className="overflow-x-auto">
          <table className="text-[11px] w-full" aria-label={`${field.label} matrix`}>
            <thead>
              <tr>
                <th className="w-24" />
                {(field.matrixColumns ?? []).map(col => (
                  <th key={col.id} className="text-center font-normal text-gray-500 pb-1">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(field.matrixRows ?? []).map(row => (
                <tr key={row.id}>
                  <td className="text-gray-600 pr-2 py-0.5">{row.label}</td>
                  {(field.matrixColumns ?? []).map(col => (
                    <td key={col.id} className="text-center py-0.5">
                      <div className={cn(
                        'mx-auto h-3.5 w-3.5 border border-gray-300 bg-white',
                        field.matrixType === 'checkbox' ? 'rounded-sm' : 'rounded-full'
                      )} aria-hidden="true" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {field.type === 'file_upload' && (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-center">
          <p className="text-[12px] text-gray-400">Click to upload or drag & drop</p>
        </div>
      )}

      {field.type === 'signature' && (
        <div className="h-16 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center">
          <span className="text-[12px] text-gray-400 italic">Signature area</span>
        </div>
      )}

      {field.type === 'hidden_field' && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] bg-gray-100 text-gray-500 rounded px-2 py-0.5">Hidden</span>
          {field.metadataKey && <span className="text-[11px] text-gray-400">← token.{field.metadataKey}</span>}
        </div>
      )}

      {field.type === 'calculated_field' && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5">
          <code className="text-[11px] text-gray-500">{field.formula || 'No formula set'}</code>
        </div>
      )}
    </div>
  )
}

function SortableFieldCard({ field, isSelected, onSelect, onDelete, onDuplicate, otherPages, onMoveToPage }: {
  field: FormField
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  otherPages: Array<{ id: string; title: string; index: number }>
  onMoveToPage: (targetIndex: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-xl border bg-white transition-all cursor-pointer',
        isSelected
          ? 'border-orange-400 ring-2 ring-orange-100 shadow-sm'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-sm',
        isDragging && 'shadow-lg'
      )}
      onClick={onSelect}
      aria-selected={isSelected}
      role="option"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded"
        aria-label="Drag to reorder"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
      </button>

      <div className="px-8 py-4">
        <FieldPreview field={field} />
      </div>

      {/* Action buttons */}
      <div
        className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        {otherPages.length > 0 && (
          <div className="relative group/move">
            <button
              className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              aria-label="Move to page"
            >
              <MoveRight className="h-3 w-3" aria-hidden="true" />
            </button>
            <div className="absolute right-0 top-full mt-0.5 z-10 min-w-[120px] rounded-lg border border-gray-200 bg-white shadow-lg py-1 hidden group-hover/move:block group-focus-within/move:block">
              <p className="text-[10px] text-gray-400 px-2.5 pb-1 font-medium uppercase tracking-wide">Move to</p>
              {otherPages.map(p => (
                <button
                  key={p.id}
                  onClick={() => onMoveToPage(p.index)}
                  className="block w-full text-left px-2.5 py-1 text-[12px] text-gray-700 hover:bg-gray-50"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={onDuplicate}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          aria-label="Duplicate field"
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label="Delete field"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {/* Field type pill */}
      <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] font-medium uppercase tracking-wide text-gray-400">
          {FIELD_TYPE_LABELS[field.type] ?? field.type}
        </span>
      </div>
    </div>
  )
}

interface Props {
  page: FormPage
  selectedFieldId: string | null
  onSelectField: (id: string) => void
  onReorderFields: (fields: FormField[]) => void
  onDeleteField: (id: string) => void
  onAddPage: () => void
  onUpdatePageTitle: (title: string) => void
  isOnlyPage: boolean
  onDeletePage: () => void
  onAddField: (field: FormField) => void
  allPages: FormPage[]
  currentPageIndex: number
  onMoveFieldToPage: (fieldId: string, targetPageIndex: number) => void
}

export function FormCanvas({
  page,
  selectedFieldId,
  onSelectField,
  onReorderFields,
  onDeleteField,
  onAddPage,
  onUpdatePageTitle,
  isOnlyPage,
  onDeletePage,
  onAddField,
  allPages,
  currentPageIndex,
  onMoveFieldToPage,
}: Props) {
  const otherPages = allPages
    .map((p, i) => ({ id: p.id, title: p.title || `Page ${i + 1}`, index: i }))
    .filter((_, i) => i !== currentPageIndex)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = page.fields.findIndex(f => f.id === active.id)
      const newIndex = page.fields.findIndex(f => f.id === over.id)
      onReorderFields(arrayMove(page.fields, oldIndex, newIndex))
    }
  }

  function duplicateField(field: FormField) {
    const copy: FormField = { ...JSON.parse(JSON.stringify(field)), id: nanoid() }
    const idx = page.fields.findIndex(f => f.id === field.id)
    const newFields = [...page.fields]
    newFields.splice(idx + 1, 0, copy)
    onReorderFields(newFields)
    onSelectField(copy.id)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      {/* Page header - only show when multiple pages exist */}
      {!isOnlyPage && (
        <div className="mb-6 flex items-center justify-between">
          <input
            value={page.title}
            onChange={e => onUpdatePageTitle(e.target.value)}
            className="text-[15px] font-semibold text-gray-700 bg-transparent border-none outline-none focus:ring-0 w-full"
            aria-label="Page title"
          />
          <button
            onClick={onDeletePage}
            className="ml-2 text-[12px] text-gray-400 hover:text-red-500 transition-colors focus:outline-none focus-visible:underline"
            aria-label="Delete this page"
          >
            Delete page
          </button>
        </div>
      )}

      {/* Fields */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={page.fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
          <div
            className="space-y-3"
            role="listbox"
            aria-label="Form fields"
            aria-multiselectable="false"
          >
            {page.fields.map(field => (
              <SortableFieldCard
                key={field.id}
                field={field}
                isSelected={selectedFieldId === field.id}
                onSelect={() => onSelectField(field.id)}
                onDelete={() => onDeleteField(field.id)}
                onDuplicate={() => duplicateField(field)}
                otherPages={otherPages}
                onMoveToPage={(targetIndex) => onMoveFieldToPage(field.id, targetIndex)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Empty state */}
      {page.fields.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-[14px] font-medium text-gray-400">This page has no fields</p>
          <p className="text-[13px] text-gray-400 mt-1">Click a field type in the left panel to add it</p>
        </div>
      )}
    </div>
  )
}
