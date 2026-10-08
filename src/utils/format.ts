/**
 * utils/format.ts
 * ---------------
 * Showing numbers, dates and file names the way a person expects to see them.
 */

import type { CellValue } from '../types'

/** Turns what the user typed into a plain number. Handles "405,200" and "". */
export function parseNumber(value: CellValue | undefined | null): number {
  if (value === undefined || value === null) return 0
  if (Array.isArray(value)) return 0
  const cleaned = value.replace(/[^0-9.\-]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Shows a number with thousands separators: 405200 becomes "405,200". */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 100) / 100
  return rounded.toLocaleString('en-US')
}

/** The value shown in an amount or quantity box. */
export function formatNumberCell(value: CellValue | undefined): string {
  const number = parseNumber(value)
  return number === 0 ? '' : formatNumber(number)
}

/** Amounts are stored as plain digits, so "405,200" is cleaned to "405200". */
export function cleanNumberText(text: string): string {
  return text.replace(/[^0-9.\-]/g, '')
}

/** Shows a cell as one line of text. Multi cells become a comma list. */
export function cellToText(value: CellValue | undefined): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return value
}

/** Shows a cell as several separate words (for tags). */
export function cellToList(value: CellValue | undefined): string[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value.filter((item) => item.trim() !== '')
  return value.trim() === '' ? [] : [value]
}

/** A date and clock time, like "30 Sep 2026, 10:42". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Just the clock time, like "10:42". */
export function formatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** A date part for the date box: "2026-09-30". Empty if the text is not a date. */
export function toDateInputValue(value: CellValue | undefined): string {
  const text = cellToText(value).trim()
  if (text === '') return ''
  // "2026-09-30" or "30/09/2026" or "2026/09/30" are the usual ways people type.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const slash = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text)
  if (slash) return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return ''
}

/**
 * A number that sorts dates correctly. Words like "July 2026" get a number from
 * the date, and text that cannot be understood gets 0 so it simply sorts first.
 */
export function dateSortNumber(value: CellValue | undefined): number {
  const text = cellToText(value).trim()
  if (text === '') return 0
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
  // "July 2026" is understood by the browser; if not, try the first number found.
  const firstNumber = Number.parseInt(text.replace(/[^0-9].*$/, ''), 10)
  return Number.isFinite(firstNumber) ? firstNumber : 0
}

/**
 * Turns a document title into a safe file name.
 * Windows does not allow \ / : * ? " < > | and we also avoid very long names.
 */
export function safeFileName(title: string, fallback = 'document'): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/[\s_]+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/^[_\s]+/, '')
    .trim()
  if (cleaned === '') return fallback
  return cleaned.slice(0, 80).trim()
}

/** Makes a file name unique inside a folder by adding " (2)", " (3)" and so on. */
export function uniqueFileName(name: string, takenNames: Iterable<string>): string {
  const used = new Set<string>()
  for (const item of takenNames) used.add(item.toLowerCase())
  if (!used.has(name.toLowerCase())) return name
  let counter = 2
  while (used.has(`${name} (${counter})`.toLowerCase())) counter += 1
  return `${name} (${counter})`
}

/** Joins words into "3 rows" / "1 row". */
export function plural(count: number, word: string): string {
  return `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`
}

/** Turns a file name into a title, for files dropped in from outside. */
export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.(json|pdf)$/i, '').replace(/\s*\(\d+\)$/, '')
}
