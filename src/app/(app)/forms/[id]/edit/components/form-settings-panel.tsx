'use client'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { FormSettings, PeriodType } from '@/types/forms'

interface Props {
  settings: FormSettings
  onUpdate: (updates: Partial<FormSettings>) => void
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
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium text-gray-700 cursor-pointer block">{label}</label>
        {description && <p className="text-[11px] text-gray-400">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  )
}

// Generate month options for the past 3 years + next 12 months
function monthOptions(): { value: string; label: string }[] {
  const now = new Date()
  const options: { value: string; label: string }[] = []
  for (let offset = -35; offset <= 11; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    options.push({ value, label })
  }
  return options.reverse()
}


export function FormSettingsPanel({ settings, onUpdate }: Props) {
  const periodType = settings.periodType
  const periodValue = settings.periodValue ?? ''

  function handlePeriodTypeChange(type: PeriodType | '') {
    if (!type) {
      onUpdate({ periodType: undefined, periodValue: undefined })
    } else {
      onUpdate({ periodType: type, periodValue: undefined })
    }
  }

  function handlePeriodValueChange(value: string) {
    onUpdate({ periodValue: value || undefined })
  }

  return (
    <div>
      <Section title="Reporting Period">
        <div>
          <Label htmlFor="period-type">Period type</Label>
          <select
            id="period-type"
            value={periodType ?? ''}
            onChange={e => handlePeriodTypeChange(e.target.value as PeriodType | '')}
            className="w-full h-8 rounded-md border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            aria-label="Period type"
          >
            <option value="">No period assigned</option>
            <option value="month">Month / Year</option>
            <option value="quarter">Quarter / Year</option>
          </select>
          <p className="text-[11px] text-gray-400 mt-1">Used for impact dashboard grouping and trend reporting</p>
        </div>

        {periodType === 'month' && (
          <div>
            <Label htmlFor="period-month">Month</Label>
            <select
              id="period-month"
              value={periodValue}
              onChange={e => handlePeriodValueChange(e.target.value)}
              className="w-full h-8 rounded-md border border-gray-200 px-2.5 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              aria-label="Select month"
            >
              <option value="">Select month…</option>
              {monthOptions().map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {periodType === 'quarter' && (
          <div>
            <Label htmlFor="period-quarter">Quarter label</Label>
            <Input
              id="period-quarter"
              value={periodValue}
              onChange={e => handlePeriodValueChange(e.target.value)}
              placeholder="e.g. Fall 2025, Spring Semester 2026"
              className="h-8 text-[13px]"
              aria-label="Quarter label"
            />
            <p className="text-[11px] text-gray-400 mt-1">Use any label — your quarters don&apos;t need to follow the calendar year</p>
          </div>
        )}

        {periodValue && (
          <p className="text-[11px] text-orange-600 font-medium">
            Assigned to: {periodValue}
          </p>
        )}
      </Section>

      <Section title="Responses">
        <div>
          <Label htmlFor="max-submissions">Max submissions</Label>
          <Input
            id="max-submissions"
            type="number"
            min={1}
            value={settings.maxSubmissions ?? ''}
            onChange={e => onUpdate({ maxSubmissions: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Unlimited"
            className="h-8 text-[13px]"
            aria-label="Maximum number of submissions"
          />
        </div>
        <ToggleRow
          id="one-per-email"
          label="One submission per email"
          description="Prevents the same email from submitting twice"
          checked={settings.onePerEmail ?? false}
          onCheckedChange={v => onUpdate({ onePerEmail: v })}
        />
        <ToggleRow
          id="allow-respondent-view"
          label="Respondents can view their submission"
          description="Shows a read-only copy after submit"
          checked={settings.allowRespondentView ?? false}
          onCheckedChange={v => onUpdate({ allowRespondentView: v })}
        />
      </Section>

      <Section title="Availability">
        <div>
          <Label htmlFor="opens-at">Opens at</Label>
          <Input
            id="opens-at"
            type="datetime-local"
            value={settings.opensAt ?? ''}
            onChange={e => onUpdate({ opensAt: e.target.value || undefined })}
            className="h-8 text-[13px]"
            aria-label="Form open date and time"
          />
        </div>
        <div>
          <Label htmlFor="closes-at">Closes at</Label>
          <Input
            id="closes-at"
            type="datetime-local"
            value={settings.closesAt ?? ''}
            onChange={e => onUpdate({ closesAt: e.target.value || undefined })}
            className="h-8 text-[13px]"
            aria-label="Form close date and time"
          />
        </div>
        <div>
          <Label htmlFor="token-expiry">Token expiry (days)</Label>
          <Input
            id="token-expiry"
            type="number"
            min={1}
            max={365}
            value={settings.tokenExpiryDays ?? ''}
            onChange={e => onUpdate({ tokenExpiryDays: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="30"
            className="h-8 text-[13px]"
            aria-label="Token expiry in days"
          />
          <p className="text-[11px] text-gray-400 mt-1">How long email invitation links remain valid</p>
        </div>
      </Section>

      <Section title="After submission">
        <div>
          <Label htmlFor="redirect-url">Redirect URL</Label>
          <Input
            id="redirect-url"
            type="url"
            value={settings.redirectUrl ?? ''}
            onChange={e => onUpdate({ redirectUrl: e.target.value || undefined })}
            placeholder="https://example.com/thank-you"
            className="h-8 text-[13px]"
            aria-label="Redirect URL after submission"
          />
          <p className="text-[11px] text-gray-400 mt-1">Leave blank to show the default confirmation page</p>
        </div>
        <div>
          <Label htmlFor="confirmation-msg">Confirmation message</Label>
          <Textarea
            id="confirmation-msg"
            value={settings.confirmationMessage ?? ''}
            onChange={e => onUpdate({ confirmationMessage: e.target.value || undefined })}
            placeholder="Thank you for your response!"
            className="text-[13px] min-h-[60px]"
            aria-label="Confirmation message shown after submission"
          />
        </div>
      </Section>

      <Section title="Notifications">
        <div>
          <Label htmlFor="notification-emails">Notify these emails on new submission</Label>
          <Textarea
            id="notification-emails"
            value={(settings.notificationEmails ?? []).join('\n')}
            onChange={e => onUpdate({ notificationEmails: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
            placeholder="one@example.com&#10;two@example.com"
            className="text-[13px] min-h-[72px] font-mono"
            aria-label="Notification email addresses, one per line"
          />
          <p className="text-[11px] text-gray-400 mt-1">One email address per line</p>
        </div>
      </Section>

      <Section title="Reminders">
        <div>
          <Label htmlFor="reminder-interval">Send reminders every N days</Label>
          <Input
            id="reminder-interval"
            type="number"
            min={1}
            max={30}
            value={settings.reminderIntervalDays ?? ''}
            onChange={e => onUpdate({ reminderIntervalDays: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="e.g. 3"
            className="h-8 text-[13px]"
            aria-label="Send reminders every N days"
          />
        </div>
        <div>
          <Label htmlFor="reminder-max">Up to N times</Label>
          <Input
            id="reminder-max"
            type="number"
            min={1}
            max={10}
            value={settings.reminderMaxCount ?? ''}
            onChange={e => onUpdate({ reminderMaxCount: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="e.g. 2"
            className="h-8 text-[13px]"
            aria-label="Send reminders up to N times"
          />
        </div>
        <p className="text-[11px] text-gray-400">Auto-reminders are sent daily to respondents who haven&apos;t completed the form</p>
      </Section>

      <Section title="Advanced">
        <div>
          <Label htmlFor="custom-css">Custom CSS</Label>
          <Textarea
            id="custom-css"
            value={settings.customCss ?? ''}
            onChange={e => onUpdate({ customCss: e.target.value || undefined })}
            placeholder=".exf-form { font-family: serif; }"
            className="text-[12px] font-mono min-h-[80px]"
            aria-label="Custom CSS for form styling"
          />
        </div>
      </Section>
    </div>
  )
}
