'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { FormSchema, FormField, FormPage } from '@/types/forms'

function PreviewField({ field }: { field: FormField }) {
  if (field.hidden) return null

  if (field.type === 'section_header') {
    return (
      <div className="pt-4">
        <h3 className="text-[17px] font-semibold text-gray-800">{field.label}</h3>
        {field.content && <p className="text-[14px] text-gray-500 mt-1">{field.content}</p>}
        <div className="mt-3 border-b border-gray-200" />
      </div>
    )
  }

  if (field.type === 'instructional_text') {
    return <p className="text-[14px] text-gray-600 leading-relaxed">{field.content}</p>
  }

  if (field.type === 'spacer') {
    return <div className="h-6" />
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={`preview-${field.id}`} className="text-[14px] font-medium text-gray-800 block">
        {field.label || <span className="text-gray-400 italic">Untitled question</span>}
        {field.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        {field.required && <span className="sr-only"> (required)</span>}
      </label>
      {field.helpText && <p className="text-[12px] text-gray-500">{field.helpText}</p>}

      {(field.type === 'short_text' || field.type === 'email' || field.type === 'url') && (
        <input
          id={`preview-${field.id}`}
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
          placeholder={field.placeholder}
          className="w-full h-10 rounded-lg border border-gray-200 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          aria-required={field.required}
          disabled
        />
      )}
      {field.type === 'number' && (
        <input id={`preview-${field.id}`} type="number" placeholder={field.placeholder} className="w-full h-10 rounded-lg border border-gray-200 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-orange-400" aria-required={field.required} disabled />
      )}
      {field.type === 'date' && (
        <input id={`preview-${field.id}`} type="date" className="w-full h-10 rounded-lg border border-gray-200 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-orange-400" aria-required={field.required} disabled />
      )}
      {field.type === 'long_text' && (
        <textarea id={`preview-${field.id}`} placeholder={field.placeholder} rows={4} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" aria-required={field.required} disabled />
      )}
      {field.type === 'single_choice' && (
        <div className="space-y-2" role="radiogroup" aria-labelledby={`preview-${field.id}`} aria-required={field.required}>
          {(field.options ?? []).map(opt => (
            <label key={opt.id} className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" name={`preview-${field.id}`} value={opt.value} className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300" disabled />
              <span className="text-[14px] text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
      {field.type === 'multiple_choice' && (
        <div className="space-y-2" role="group" aria-labelledby={`preview-${field.id}`}>
          {(field.options ?? []).map(opt => (
            <label key={opt.id} className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" value={opt.value} className="h-4 w-4 rounded text-orange-600 focus:ring-orange-500 border-gray-300" disabled />
              <span className="text-[14px] text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
      {field.type === 'dropdown' && (
        <select id={`preview-${field.id}`} className="w-full h-10 rounded-lg border border-gray-200 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" aria-required={field.required} disabled>
          <option value="">Select an option…</option>
          {(field.options ?? []).map(opt => <option key={opt.id} value={opt.value}>{opt.label}</option>)}
        </select>
      )}
      {field.type === 'rating' && (
        <div className="flex gap-2" role="radiogroup" aria-label={field.label}>
          {[...Array(field.max ?? 5)].map((_, i) => (
            <button key={i} className="text-2xl text-gray-200 hover:text-yellow-400 focus:text-yellow-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded" aria-label={`${i + 1} star`} disabled>★</button>
          ))}
        </div>
      )}
      {field.type === 'likert_scale' && (
        <div>
          <div className="flex gap-3" role="radiogroup" aria-label={field.label}>
            {[...Array(field.scale ?? 5)].map((_, i) => (
              <label key={i} className="flex flex-col items-center gap-1">
                <input type="radio" name={`preview-${field.id}`} className="h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500" disabled />
                <span className="text-[11px] text-gray-500">{i + 1}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-gray-400">{field.scaleLabels?.start}</span>
            <span className="text-[11px] text-gray-400">{field.scaleLabels?.end}</span>
          </div>
        </div>
      )}
      {field.type === 'nps' && (
        <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-label={field.label}>
          {[...Array(11)].map((_, i) => (
            <label key={i} className="flex flex-col items-center">
              <input type="radio" name={`preview-${field.id}`} value={i} className="sr-only" disabled />
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-[13px] text-gray-600 hover:border-orange-400 cursor-pointer">{i}</span>
            </label>
          ))}
        </div>
      )}
      {field.type === 'file_upload' && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
          <p className="text-[14px] text-gray-400">Click to upload or drag & drop</p>
          {field.acceptedFileTypes && <p className="text-[12px] text-gray-400 mt-1">{field.acceptedFileTypes.join(', ')}</p>}
        </div>
      )}
      {field.type === 'signature' && (
        <div className="h-24 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
          <p className="text-[13px] text-gray-400 italic">Draw signature here</p>
        </div>
      )}
    </div>
  )
}

export function FormPreview({ schema }: { schema: FormSchema }) {
  const [pageIndex, setPageIndex] = useState(0)
  const page = schema.pages[pageIndex] ?? schema.pages[0]

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      {schema.pages.length > 1 && (
        <div className="mb-6">
          <div className="h-1.5 rounded-full bg-gray-100" role="progressbar" aria-valuenow={pageIndex + 1} aria-valuemin={1} aria-valuemax={schema.pages.length} aria-label="Form progress">
            <div
              className="h-full rounded-full bg-orange-500 transition-all"
              style={{ width: `${((pageIndex + 1) / schema.pages.length) * 100}%` }}
            />
          </div>
          <p className="text-[12px] text-gray-400 mt-1.5">Page {pageIndex + 1} of {schema.pages.length}</p>
        </div>
      )}

      <h2 className="text-[18px] font-semibold text-gray-900 mb-6">{page.title}</h2>

      <div className="space-y-6">
        {page.fields.map(field => <PreviewField key={field.id} field={field} />)}
      </div>

      <div className="flex items-center justify-between mt-10">
        {pageIndex > 0 && (
          <button
            onClick={() => setPageIndex(i => i - 1)}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-[14px] font-medium text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            Back
          </button>
        )}
        <div className="flex-1" />
        {pageIndex < schema.pages.length - 1 ? (
          <button
            onClick={() => setPageIndex(i => i + 1)}
            className="px-5 py-2.5 rounded-lg bg-orange-600 text-white text-[14px] font-medium hover:bg-orange-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            Next
          </button>
        ) : (
          <button
            className="px-5 py-2.5 rounded-lg bg-orange-600 text-white text-[14px] font-medium hover:bg-orange-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            disabled
          >
            Submit
          </button>
        )}
      </div>
    </div>
  )
}
