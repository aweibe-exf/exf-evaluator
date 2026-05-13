import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date string correctly regardless of whether it's date-only (YYYY-MM-DD)
 * or a full ISO timestamp.
 *
 * The ECMAScript spec parses bare "YYYY-MM-DD" strings as UTC midnight, which shifts
 * them to the previous day in any negative-offset timezone (all of the US).
 * Appending T00:00:00 forces local-time interpretation, matching user intent.
 */
export function parseDate(s: string): Date {
  // Date-only strings are exactly 10 chars: YYYY-MM-DD
  return new Date(s.length === 10 ? `${s}T00:00:00` : s)
}

/**
 * Return today's date as a YYYY-MM-DD string in the user's LOCAL timezone.
 * Never use new Date().toISOString().slice(0, 10) — that returns the UTC date,
 * which is wrong for anyone west of UTC.
 */
export function todayLocalIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
