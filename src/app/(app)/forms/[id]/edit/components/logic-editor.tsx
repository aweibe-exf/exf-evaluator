'use client'

import { nanoid } from 'nanoid'
import { Plus, Trash2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { FormField, FormPage, LogicRule, LogicCondition, LogicOperator } from '@/types/forms'

const OPERATORS: { value: LogicOperator; label: string; noValue?: boolean }[] = [
  { value: 'equals',       label: 'equals' },
  { value: 'not_equals',   label: 'does not equal' },
  { value: 'contains',     label: 'contains' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than',    label: 'is less than' },
  { value: 'is_empty',     label: 'is empty',     noValue: true },
  { value: 'is_not_empty', label: 'is not empty', noValue: true },
]

interface Props {
  field: FormField
  allFields: FormField[]
  allPages: FormPage[]
  onUpdate: (updates: Partial<FormField>) => void
}

function makeEmptyCondition(): LogicCondition {
  return { fieldId: '', operator: 'equals', value: '' }
}

function makeEmptyRule(): LogicRule {
  return {
    action: 'show',
    combinator: 'and',
    conditions: [makeEmptyCondition()],
  }
}

export function LogicEditor({ field, allFields, allPages, onUpdate }: Props) {
  const rules: LogicRule[] = (field.logic as LogicRule[] | undefined) ?? []

  // Other fields available as condition sources (exclude self and layout fields)
  const conditionableFields = allFields.filter(
    f => f.id !== field.id && !['section_header', 'instructional_text', 'spacer', 'hidden_field'].includes(f.type)
  )

  function setRules(next: LogicRule[]) {
    onUpdate({ logic: next })
  }

  function addRule() {
    setRules([...rules, makeEmptyRule()])
  }

  function removeRule(ruleIndex: number) {
    setRules(rules.filter((_, i) => i !== ruleIndex))
  }

  function updateRule(ruleIndex: number, updates: Partial<LogicRule>) {
    setRules(rules.map((r, i) => i === ruleIndex ? { ...r, ...updates } : r))
  }

  function addCondition(ruleIndex: number) {
    const rule = rules[ruleIndex]
    updateRule(ruleIndex, { conditions: [...rule.conditions, makeEmptyCondition()] })
  }

  function removeCondition(ruleIndex: number, condIndex: number) {
    const rule = rules[ruleIndex]
    updateRule(ruleIndex, { conditions: rule.conditions.filter((_, i) => i !== condIndex) })
  }

  function updateCondition(ruleIndex: number, condIndex: number, updates: Partial<LogicCondition>) {
    const rule = rules[ruleIndex]
    updateRule(ruleIndex, {
      conditions: rule.conditions.map((c, i) => i === condIndex ? { ...c, ...updates } : c),
    })
  }

  if (rules.length === 0) {
    return (
      <div>
        <p className="text-[12px] text-gray-400 mb-2">No logic rules yet. This field is always visible.</p>
        <button
          onClick={addRule}
          className="flex items-center gap-1 text-[12px] text-orange-600 hover:text-orange-700 transition-colors focus:outline-none focus-visible:underline"
          aria-label="Add conditional logic rule"
        >
          <Plus className="h-3 w-3" aria-hidden="true" /> Add rule
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {rules.map((rule, ruleIndex) => (
        <fieldset
          key={ruleIndex}
          className="rounded-lg border border-gray-100 p-2.5 space-y-2"
        >
          <legend className="sr-only">Logic rule {ruleIndex + 1}</legend>

          {/* Action + combinator row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Select
              value={rule.action}
              onValueChange={v => updateRule(ruleIndex, { action: v as LogicRule['action'] })}
            >
              <SelectTrigger className="h-7 w-auto text-[11px] flex-shrink-0" aria-label="Action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="show">Show this field</SelectItem>
                <SelectItem value="hide">Hide this field</SelectItem>
                <SelectItem value="skip_to_page">Skip to page</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[11px] text-gray-500">if</span>
            <Select
              value={rule.combinator}
              onValueChange={v => updateRule(ruleIndex, { combinator: v as 'and' | 'or' })}
            >
              <SelectTrigger className="h-7 w-auto text-[11px] flex-shrink-0" aria-label="Condition combinator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">ALL of</SelectItem>
                <SelectItem value="or">ANY of</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[11px] text-gray-500">these are true:</span>
          </div>

          {/* Skip-to-page target */}
          {rule.action === 'skip_to_page' && (
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Target page</label>
              <Select
                value={rule.targetPageId ?? ''}
                onValueChange={v => updateRule(ruleIndex, { targetPageId: v ?? undefined })}
              >
                <SelectTrigger className="h-7 text-[11px]" aria-label="Target page to skip to">
                  <SelectValue placeholder="Select page…" />
                </SelectTrigger>
                <SelectContent>
                  {allPages.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conditions */}
          <div className="space-y-1.5">
            {rule.conditions.map((cond, condIndex) => {
              const op = OPERATORS.find(o => o.value === cond.operator)
              return (
                <div key={condIndex} className="flex items-center gap-1 flex-wrap">
                  <Select
                    value={cond.fieldId}
                    onValueChange={v => updateCondition(ruleIndex, condIndex, { fieldId: v ?? '' })}
                  >
                    <SelectTrigger className="h-7 text-[11px] flex-1 min-w-0" aria-label={`Condition ${condIndex + 1} field`}>
                      <SelectValue placeholder="Field…" />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionableFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={cond.operator}
                    onValueChange={v => updateCondition(ruleIndex, condIndex, { operator: v as LogicOperator })}
                  >
                    <SelectTrigger className="h-7 text-[11px] w-auto flex-shrink-0" aria-label={`Condition ${condIndex + 1} operator`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!op?.noValue && (
                    <Input
                      value={String(cond.value ?? '')}
                      onChange={e => updateCondition(ruleIndex, condIndex, { value: e.target.value })}
                      placeholder="Value…"
                      className="h-7 text-[11px] w-24 flex-shrink-0"
                      aria-label={`Condition ${condIndex + 1} value`}
                    />
                  )}

                  {rule.conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(ruleIndex, condIndex)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      aria-label={`Remove condition ${condIndex + 1}`}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => addCondition(ruleIndex)}
              className="flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-700 transition-colors focus:outline-none focus-visible:underline"
              aria-label="Add condition"
            >
              <Plus className="h-3 w-3" aria-hidden="true" /> Add condition
            </button>
            <button
              onClick={() => removeRule(ruleIndex)}
              className="text-[11px] text-gray-400 hover:text-red-500 transition-colors focus:outline-none focus-visible:underline"
              aria-label="Remove this rule"
            >
              Remove rule
            </button>
          </div>
        </fieldset>
      ))}

      <button
        onClick={addRule}
        className="flex items-center gap-1 text-[12px] text-orange-600 hover:text-orange-700 transition-colors focus:outline-none focus-visible:underline"
        aria-label="Add another rule"
      >
        <Plus className="h-3 w-3" aria-hidden="true" /> Add another rule
      </button>
    </div>
  )
}
