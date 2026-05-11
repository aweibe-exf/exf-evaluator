'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, UserPlus } from 'lucide-react'
import type { FormSchema, FormField, FormPage, LogicRule, LogicCondition } from '@/types/forms'

interface Props {
  formId: string
  formName: string
  schema: FormSchema
  token: string
  respondentEmail?: string
  programName: string
  brandColor: string
  confirmationMessage?: string
  redirectUrl?: string
}

// ─── Logic evaluation ───────────────────────────────────────────────────────

function evalCondition(cond: LogicCondition, data: Record<string, unknown>): boolean {
  const val = String(data[cond.fieldId] ?? '')
  const cmp = String(cond.value ?? '')
  switch (cond.operator) {
    case 'equals':       return val === cmp
    case 'not_equals':   return val !== cmp
    case 'contains':     return val.includes(cmp)
    case 'greater_than': return Number(val) > Number(cmp)
    case 'less_than':    return Number(val) < Number(cmp)
    case 'is_empty':     return val === '' || val === 'undefined'
    case 'is_not_empty': return val !== '' && val !== 'undefined'
    default:             return true
  }
}

function evalRule(rule: LogicRule, data: Record<string, unknown>): boolean {
  const results = rule.conditions.map(c => evalCondition(c, data))
  return rule.combinator === 'and' ? results.every(Boolean) : results.some(Boolean)
}

function isVisible(field: FormField, data: Record<string, unknown>): boolean {
  const rules = field.logic ?? []
  if (rules.length === 0) return true
  const showRules = rules.filter(r => r.action === 'show')
  const hideRules = rules.filter(r => r.action === 'hide')
  if (hideRules.some(r => evalRule(r, data))) return false
  if (showRules.length > 0) return showRules.some(r => evalRule(r, data))
  return true
}

function getSkipTarget(page: FormPage, data: Record<string, unknown>): string | null {
  for (const field of page.fields) {
    for (const rule of field.logic ?? []) {
      if (rule.action === 'skip_to_page' && rule.targetPageId && evalRule(rule, data)) {
        return rule.targetPageId
      }
    }
  }
  return null
}

// ─── Field renderer ──────────────────────────────────────────────────────────

const LAYOUT_TYPES = ['section_header', 'instructional_text', 'spacer', 'hidden_field', 'page_break', 'calculated_field', 'signature'] as const

function FieldInput({ field, value, onChange }: {
  field: FormField
  value: unknown
  onChange: (val: unknown) => void
}) {
  const id = `field-${field.id}`
  const strVal = String(value ?? '')
  const base = 'w-full rounded-lg border border-gray-200 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent'

  // Layout-only fields
  if ((LAYOUT_TYPES as readonly string[]).includes(field.type)) {
    if (field.type === 'section_header') return <h3 className="text-[16px] font-semibold text-gray-800 pt-2">{field.label || field.content}</h3>
    if (field.type === 'instructional_text') return <p className="text-[14px] text-gray-600">{field.content || field.label}</p>
    if (field.type === 'spacer') return <div className="h-4" />
    return null
  }

  const label = (
    <label htmlFor={id} className="block text-[14px] font-medium text-gray-800 mb-1.5">
      {field.label}
      {field.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      {field.required && <span className="sr-only"> (required)</span>}
    </label>
  )
  const help = field.helpText ? <p className="text-[12px] text-gray-400 mt-1">{field.helpText}</p> : null

  switch (field.type) {
    case 'short_text':
    case 'email':
    case 'url':
    case 'number': {
      const typeMap: Record<string, string> = { email: 'email', url: 'url', number: 'number' }
      return (
        <div>
          {label}
          <input
            id={id}
            type={typeMap[field.type] ?? 'text'}
            value={strVal}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            aria-required={field.required}
            className={`${base} h-10`}
          />
          {help}
        </div>
      )
    }
    case 'long_text':
      return (
        <div>
          {label}
          <textarea id={id} value={strVal} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} required={field.required} aria-required={field.required} rows={4} className={`${base} py-2 resize-none`} />
          {help}
        </div>
      )
    case 'date':
      return (
        <div>
          {label}
          <input id={id} type="date" value={strVal} onChange={e => onChange(e.target.value)} required={field.required} aria-required={field.required} className={`${base} h-10`} />
          {help}
        </div>
      )
    case 'single_choice': {
      const opts = field.options ?? []
      return (
        <div>
          <fieldset>
            <legend className="block text-[14px] font-medium text-gray-800 mb-1.5">
              {field.label}{field.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
            </legend>
            {help}
            <div className="space-y-2 mt-2">
              {opts.map(opt => (
                <label key={opt.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="radio" name={id} value={opt.value} checked={strVal === opt.value} onChange={() => onChange(opt.value)} required={field.required} className="h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500" />
                  <span className="text-[14px] text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )
    }
    case 'multiple_choice': {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <div>
          <fieldset>
            <legend className="block text-[14px] font-medium text-gray-800 mb-1.5">
              {field.label}{field.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
            </legend>
            {help}
            <div className="space-y-2 mt-2">
              {(field.options ?? []).map(opt => (
                <label key={opt.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={selected.includes(opt.value)}
                    onChange={e => {
                      const next = e.target.checked ? [...selected, opt.value] : selected.filter(v => v !== opt.value)
                      onChange(next)
                    }}
                    className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-[14px] text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )
    }
    case 'dropdown':
      return (
        <div>
          {label}
          <select id={id} value={strVal} onChange={e => onChange(e.target.value)} required={field.required} aria-required={field.required} className={`${base} h-10 bg-white`}>
            <option value="">Select…</option>
            {(field.options ?? []).map(opt => <option key={opt.id} value={opt.value}>{opt.label}</option>)}
          </select>
          {help}
        </div>
      )
    case 'rating':
    case 'likert_scale':
    case 'nps': {
      const max = field.scale ?? field.max ?? (field.type === 'nps' ? 10 : 5)
      const labels = field.scaleLabels ?? {}
      return (
        <div>
          <fieldset>
            <legend className="block text-[14px] font-medium text-gray-800 mb-1.5">
              {field.label}{field.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
            </legend>
            {help}
            <div className="flex gap-2 mt-2 flex-wrap">
              {Array.from({ length: max }, (_, i) => i + 1).map(n => (
                <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
                  <input type="radio" name={id} value={String(n)} checked={strVal === String(n)} onChange={() => onChange(String(n))} required={field.required} className="sr-only" />
                  <span className={`w-10 h-10 flex items-center justify-center rounded-lg border text-[14px] font-medium transition-colors cursor-pointer ${strVal === String(n) ? 'bg-orange-600 border-orange-600 text-white' : 'border-gray-200 text-gray-600 hover:border-orange-400'}`}>
                    {n}
                  </span>
                  {n === 1 && labels.start && <span className="text-[10px] text-gray-400 max-w-[40px] text-center leading-tight">{labels.start}</span>}
                  {n === max && labels.end && <span className="text-[10px] text-gray-400 max-w-[40px] text-center leading-tight">{labels.end}</span>}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )
    }
    case 'slider':
      return (
        <div>
          {label}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[12px] text-gray-400">{field.min ?? 0}</span>
            <input type="range" id={id} min={field.min ?? 0} max={field.max ?? 100} step={field.step ?? 1} value={strVal || String(field.min ?? 0)} onChange={e => onChange(e.target.value)} className="flex-1 accent-orange-600" />
            <span className="text-[12px] text-gray-400">{field.max ?? 100}</span>
            <span className="text-[13px] font-semibold text-gray-700 w-10 text-right">{strVal || (field.min ?? 0)}</span>
          </div>
          {help}
        </div>
      )
    case 'matrix': {
      const rows = field.matrixRows ?? []
      const cols = field.matrixColumns ?? []
      const matrixVal = (value as Record<string, string> | undefined) ?? {}
      return (
        <div>
          <p className="text-[14px] font-medium text-gray-800 mb-2">
            {field.label}{field.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </p>
          {help}
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-[13px]" role="grid" aria-label={field.label}>
              <thead>
                <tr>
                  <th className="text-left pb-2 text-gray-400 font-normal w-1/3" />
                  {cols.map(col => <th key={col.id} className="pb-2 text-gray-600 font-medium text-center px-2">{col.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-t border-gray-50">
                    <td className="py-2.5 pr-4 text-gray-700">{row.label}</td>
                    {cols.map(col => (
                      <td key={col.id} className="py-2.5 text-center px-2">
                        <input
                          type={field.matrixType === 'checkbox' ? 'checkbox' : 'radio'}
                          name={`${id}-${row.id}`}
                          value={col.id}
                          checked={matrixVal[row.id] === col.id}
                          onChange={() => onChange({ ...matrixVal, [row.id]: col.id })}
                          className="h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                          aria-label={`${row.label} — ${col.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
    case 'file_upload':
      return (
        <div>
          {label}
          <input id={id} type="file" onChange={e => onChange(e.target.files?.[0]?.name ?? '')} required={field.required} aria-required={field.required} className="block w-full text-[13px] text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-[13px] file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
          {help}
        </div>
      )
    default:
      return (
        <div>
          {label}
          <input id={id} type="text" value={strVal} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} required={field.required} aria-required={field.required} className={`${base} h-10`} />
          {help}
        </div>
      )
  }
}

// ─── Main renderer ───────────────────────────────────────────────────────────

export function FormRenderer({ formId, formName, schema, token, respondentEmail, programName, brandColor, confirmationMessage, redirectUrl }: Props) {
  const [pageIndex, setPageIndex] = useState(0)
  const [data, setData] = useState<Record<string, unknown>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentPage = schema.pages[pageIndex]
  const totalPages = schema.pages.length
  const isLastPage = pageIndex === totalPages - 1

  const setValue = useCallback((fieldId: string, val: unknown) => {
    setData(prev => ({ ...prev, [fieldId]: val }))
  }, [])

  const visibleFields = currentPage?.fields.filter(f => isVisible(f, data)) ?? []

  function validatePage(): boolean {
    for (const field of visibleFields) {
      if (!field.required) continue
      if ((LAYOUT_TYPES as readonly string[]).includes(field.type)) continue
      const val = data[field.id]
      if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) return false
    }
    return true
  }

  function handleNext() {
    if (!validatePage()) { setError('Please fill in all required fields before continuing.'); return }
    setError(null)
    const skipTarget = getSkipTarget(currentPage, data)
    if (skipTarget) {
      const idx = schema.pages.findIndex(p => p.id === skipTarget)
      if (idx !== -1) { setPageIndex(idx); return }
    }
    setPageIndex(i => Math.min(i + 1, totalPages - 1))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validatePage()) { setError('Please fill in all required fields.'); return }
    setError(null)
    setSubmitting(true)
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, form_id: formId, data, status: 'submitted' }),
    })
    setSubmitting(false)
    if (res.ok) {
      setSubmitted(true)
      if (redirectUrl) setTimeout(() => { window.location.href = redirectUrl }, 2000)
    } else {
      const body = await res.json().catch(() => ({}))
      setError(typeof body.error === 'string' ? body.error : 'Something went wrong. Please try again.')
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" aria-hidden="true" />
            </div>
            <h1 className="text-[20px] font-semibold text-gray-800 mb-2">Response submitted</h1>
            <p className="text-[14px] text-gray-500">
              {confirmationMessage ?? 'Thank you for completing this form. Your response has been recorded.'}
            </p>
            {redirectUrl && <p className="text-[12px] text-gray-400 mt-4">Redirecting you shortly…</p>}
          </div>

          {/* Account creation CTA — shown if they have an email and aren't already logged in */}
          {respondentEmail && !redirectUrl && (
            <div className="mt-2 rounded-xl border border-orange-100 bg-orange-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <UserPlus className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 mb-0.5">Track your submissions over time</p>
                  <p className="text-[12px] text-gray-500 mb-3">
                    Create a free account to view all forms you&apos;ve completed in one place.
                  </p>
                  <a
                    href={`/auth/login?email=${encodeURIComponent(respondentEmail)}&next=/my`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-orange-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                  >
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Create account with {respondentEmail}
                  </a>
                  <p className="text-[11px] text-gray-400 mt-2">We&apos;ll send you a magic link — no password needed.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const progress = ((pageIndex + 1) / totalPages) * 100

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b" style={{ borderTopWidth: 3, borderTopColor: brandColor }}>
        <div className="max-w-2xl mx-auto px-6 py-4">
          <p className="text-[12px] text-gray-400 mb-0.5">{programName}</p>
          <h1 className="text-[18px] font-semibold text-gray-800">{formName}</h1>
        </div>
        {totalPages > 1 && (
          <div className="h-1 bg-gray-100">
            <div className="h-1 transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: brandColor }} aria-hidden="true" />
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {totalPages > 1 && (
          <p className="text-[12px] text-gray-400 mb-5">Page {pageIndex + 1} of {totalPages} — {currentPage.title}</p>
        )}
        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
            {visibleFields.map(field => (
              <FieldInput key={field.id} field={field} value={data[field.id]} onChange={val => setValue(field.id, val)} />
            ))}
            {visibleFields.length === 0 && (
              <p className="text-[14px] text-gray-400 text-center py-4">No fields on this page.</p>
            )}
          </div>

          {error && <p className="mt-3 text-[13px] text-red-600" role="alert">{error}</p>}

          <div className="mt-6 flex items-center justify-between">
            {pageIndex > 0 ? (
              <button type="button" onClick={() => { setPageIndex(i => i - 1); setError(null) }} className="text-[13px] text-gray-500 hover:text-gray-800 transition-colors focus:outline-none focus-visible:underline">
                ← Back
              </button>
            ) : <span />}
            {isLastPage ? (
              <Button type="submit" disabled={submitting} aria-busy={submitting} className="px-8" style={{ backgroundColor: brandColor }}>
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            ) : (
              <Button type="button" onClick={handleNext} style={{ backgroundColor: brandColor }}>Next →</Button>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}
