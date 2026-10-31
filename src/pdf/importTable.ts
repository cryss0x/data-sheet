/**
 * pdf/importTable.ts
 * ------------------
 * Turning the words found inside a PDF file into columns and rows.
 *
 * Every word arrives with the place it sits on the page, so the table is
 * rebuilt the way a person sees it:
 *
 *   1. words sharing a line are grouped together,
 *   2. the first line that has more than one cell in it is the heading row,
 *   3. every word after it is put under the heading whose start it sits on or
 *      just after - which keeps right-aligned numbers in the right column,
 *   4. a line written very close under the line above it is a word that was
 *      wrapped inside a cell, so it joins that row instead of becoming a new one.
 *
 * The lines this app writes under its own tables - "Page 1 of 3", "Made on ...",
 * the totals - are recognised and left out, so a PDF exported here can be
 * imported back without the totals becoming rows.
 *
 * This file never touches a PDF file itself, only positions and text, so the
 * checks in scripts/check.mjs can test it directly.
 */

import type { ColumnType } from '../types'

/** One piece of text found on a PDF page, with where it sits on the page. */
export interface PdfWord {
  /** The page it is on, counting from 1. */
  page: number
  str: string
  /** The left edge, in PDF units (72 of them make one inch). */
  x: number
  /** The line the word sits on. Words that share it are on the same line. */
  y: number
  /** The right edge: x plus the width of the word. */
  end: number
  /** Roughly the size of the letters. Used for the gaps and tolerances. */
  height: number
}

/** One line of text: every word that shares a baseline. */
export interface PdfLine {
  page: number
  y: number
  words: PdfWord[]
}

/** One stand-alone piece of a line: a cell of the heading row. */
export interface PdfCell {
  text: string
  start: number
  end: number
}

/** The table found in the file: the headings with their types, and the rows. */
export interface ParsedTable {
  columns: { name: string; type: ColumnType }[]
  rows: string[][]
}

/** Thrown when the file has no table this app can show. */
export class NoTableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoTableError'
  }
}

/** The lines this app writes under its own tables. They are not rows. */
const FOOTER_LINES = [
  /^page \d+ of \d+$/i,
  /^made on /i,
  /^totals per column$/i,
  /^grand total\b/i,
  /^rows with details\b/i,
  /^expenses per category(\s+[\d,.]+)*$/i,
  /^total expenses?(\s+[\d,.]+)*$/i,
]

/** Heading words that mean "money", so the column goes into the grand total. */
const MONEY_NAME =
  /amount|total|price|cost|salary|wage|fuel|expense|fee|fine|money|income|revenue|balance|charge|tax|payment|mileage|maintenance|maintainance|maintainence|maintanance|maintance|offence|spare parts/i

/** Heading words that mean "a number to add up, but not money". */
const QUANTITY_NAME = /quantity|quantities|litre|liter|volume|\btrips?\b|\bkm\b|kilomet|\bhours?\b|\bpcs?\b|\bunits?\b/i

/** Heading words that mean "these are not numbers to add up". */
const TEXT_NAME = /phone|mobile|contact|serial|\bcode\b|^sn$|^no\.?$|^nr\.?$|^id$|year/i

/** The ways a date is usually written in a table. */
const DATE_PATTERNS = [
  /^\d{4}-\d{1,2}-\d{1,2}$/,
  /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/,
  /^\d{1,2},?\s+[A-Za-z]{3,9},?\s+\d{4}$/,
  /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/,
  /^[A-Za-z]{3,9}\s+\d{4}$/,
]

/** How many rows one file may hold, so a strange file cannot hang the browser. */
const MAX_ROWS = 10_000

/** How many columns one file may hold. Anything wider is not a real table. */
const MAX_COLUMNS = 64

function averageHeight(words: PdfWord[]): number {
  const heights = words.map((word) => word.height).filter((height) => height > 0)
  if (heights.length === 0) return 10
  return heights.reduce((total, height) => total + height, 0) / heights.length
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function joinWords(left: string, right: string): string {
  if (left === '' || right === '') return left + right
  if (left.endsWith(' ') || right.startsWith(' ')) return left + right
  return `${left} ${right}`
}

/**
 * A PDF often stores a whole row of neighbouring boxes as one piece of text,
 * for example "1, September 2026 Fuel" for the date and the description. The
 * reader only gives the start and the width of the whole piece, so each word
 * is given the share of that width that matches its share of the characters.
 * Without this, a date and the words beside it would be put into one cell.
 */
export function splitTextIntoWords(word: PdfWord): PdfWord[] {
  const raw = word.str
  const tokens = [...raw.matchAll(/\S+/g)]
  if (tokens.length <= 1) return [word]

  const width = Math.max(word.end - word.x, 0)
  if (width === 0) return [word]

  return tokens.map((token) => {
    const start = token.index ?? 0
    return {
      ...word,
      str: token[0],
      x: word.x + (width * start) / raw.length,
      end: word.x + (width * (start + token[0].length)) / raw.length,
    }
  })
}

/** Puts every word on the page onto the line it belongs to. */
export function groupIntoLines(words: PdfWord[]): PdfLine[] {
  const pages = new Map<number, PdfWord[]>()
  for (const word of words) {
    const bucket = pages.get(word.page)
    if (bucket) bucket.push(word)
    else pages.set(word.page, [word])
  }

  const lines: PdfLine[] = []
  for (const page of [...pages.keys()].sort((a, b) => a - b)) {
    const pageWords = [...(pages.get(page) ?? [])].sort((a, b) => b.y - a.y || a.x - b.x)
    // Words are allowed to sit a little above or below the shared line, which
    // keeps small letters and superscripts with the rest of the line.
    const tolerance = Math.max(2, averageHeight(pageWords) * 0.4)
    let line: PdfLine | null = null
    for (const word of pageWords) {
      if (line && Math.abs(word.y - line.y) <= tolerance) {
        line.words.push(word)
      } else {
        line = { page, y: word.y, words: [word] }
        lines.push(line)
      }
    }
  }
  return lines
}

/**
 * Cuts one line into cells: words that sit close together belong to the same
 * cell, and a bigger gap means a new cell has started.
 */
export function splitLineIntoCells(line: PdfLine): PdfCell[] {
  const words = line.words.filter((word) => word.str.trim() !== '').sort((a, b) => a.x - b.x)
  if (words.length === 0) return []
  const gapLimit = Math.max(4, averageHeight(words) * 0.6)

  const cells: PdfCell[] = []
  for (const word of words) {
    const last = cells[cells.length - 1]
    if (last && word.x - last.end <= gapLimit) {
      last.text = joinWords(last.text, word.str)
      last.end = Math.max(last.end, word.end)
    } else {
      cells.push({ text: word.str, start: word.x, end: word.end })
    }
  }
  return cells
}

/** A key that tells two lines with exactly the same words apart from others. */
function lineKey(cells: PdfCell[]): string {
  return cells
    .map((cell) => cell.text.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter((text) => text !== '')
    .join('|')
}

/** The heading names: never blank, never twice the same. */
function headingNames(cells: PdfCell[]): string[] {
  const names: string[] = []
  cells.forEach((cell, index) => {
    const base = cell.text.trim().replace(/\s+/g, ' ') || `Column ${index + 1}`
    let name = base
    let counter = 2
    while (names.some((taken) => taken.toLowerCase() === name.toLowerCase())) {
      name = `${base} ${counter}`
      counter += 1
    }
    names.push(name)
  })
  return names
}

/** The column a word belongs to: the last heading that starts at or before it. */
function columnForX(x: number, starts: number[], slack: number): number {
  let index = 0
  for (let i = 0; i < starts.length; i += 1) {
    if (starts[i] <= x + slack) index = i
    else break
  }
  return index
}

/** Is this text written the way a date is written? */
export function looksLikeDate(text: string): boolean {
  const value = text.trim()
  return DATE_PATTERNS.some((pattern) => pattern.test(value))
}

/** Is this text a plain number, allowing "1,500,000", "75.5" and "TZS 900"? */
export function isNumericText(text: string): boolean {
  const value = text
    .trim()
    .replace(/[€$£¥]/g, '')
    .replace(/%$/, '')
    .replace(/\s/g, '')
    .replace(/(TZS|TSH|USD|GBP|EUR|KES)$/i, '')
  if (value === '') return false
  return /^-?\(?\d{1,3}(,\d{3})*(\.\d+)?\)?$/.test(value) || /^-?\(?\d+(\.\d+)?\)?$/.test(value)
}

/** Guesses what one column holds, from its heading and its words. */
export function detectColumnType(name: string, values: string[]): ColumnType {
  const filled = values.map((value) => value.trim()).filter((value) => value !== '')
  if (filled.length === 0) return 'text'
  if (TEXT_NAME.test(name.trim())) return 'text'
  if (filled.filter(looksLikeDate).length >= filled.length * 0.8) return 'date'
  if (filled.filter(isNumericText).length >= filled.length * 0.8) {
    if (QUANTITY_NAME.test(name)) return 'quantity'
    if (MONEY_NAME.test(name)) return 'amount'
    if (filled.some((value) => /\.\d/.test(value))) return 'amount'
    return 'quantity'
  }
  return 'text'
}

/**
 * Builds the table from the lines of the file, in reading order.
 * Throws a NoTableError when the file has no table we can show.
 */
export function buildTableFromLines(lines: PdfLine[]): ParsedTable {
  // Only lines with real words in them are looked at.
  const entries = lines
    .map((line) => {
      const words = line.words.filter((word) => word.str.trim() !== '')
      return {
        line: { page: line.page, y: line.y, words },
        cells: splitLineIntoCells(line),
        height: averageHeight(words),
      }
    })
    .filter((entry) => entry.line.words.length > 0)

  // The heading row: the first line that stands on more than one cell.
  const headerIndex = entries.findIndex((entry) => entry.cells.length >= 2)
  if (headerIndex < 0) {
    throw new NoTableError(
      'No table was found in this PDF. Only plain writing, or a table without headings, could be seen.',
    )
  }
  const header = entries[headerIndex]
  if (header.cells.length > MAX_COLUMNS) {
    throw new NoTableError('That table has far too many columns to be read as a document.')
  }

  const headerKey = lineKey(header.cells)
  const names = headingNames(header.cells)
  const starts = header.cells.map((cell) => cell.start)
  // A word may start a little to the left of its heading (centred headings,
  // for example), so a small allowance is given when placing it. The allowance
  // stays small: a wide heading must not pull in the last word of the column
  // before it.
  const slack = Math.max(2, Math.min(6, median(header.cells.map((cell) => cell.end - cell.start)) * 0.1))

  const rows: string[][] = []
  let current: { page: number; y: number; height: number; values: string[] } | null = null
  let skipNextLine = false

  const finishRow = () => {
    if (current) rows.push(current.values)
    current = null
  }

  for (let index = headerIndex + 1; index < entries.length && rows.length < MAX_ROWS; index += 1) {
    const entry = entries[index]
    const text = entry.cells
      .map((cell) => cell.text.trim())
      .filter((part) => part !== '')
      .join(' ')
    if (text === '') continue

    // The row of totals directly under "TOTALS PER COLUMN" is not a row.
    if (skipNextLine) {
      skipNextLine = false
      finishRow()
      continue
    }
    if (FOOTER_LINES.some((pattern) => pattern.test(text))) {
      if (/^totals per column$/i.test(text)) skipNextLine = true
      finishRow()
      continue
    }
    // The heading row is repeated on every page; only the first one is kept.
    if (lineKey(entry.cells) === headerKey) {
      finishRow()
      continue
    }

    // Every word is placed under the heading whose start it sits on or just
    // after, which keeps right-aligned numbers in the right column even when
    // two boxes sit right next to each other.
    const values = new Array<string>(names.length).fill('')
    const lastEnd = new Array<number>(names.length).fill(Number.NEGATIVE_INFINITY)
    const filled: number[] = []
    const words = entry.line.words
      .flatMap((word) => splitTextIntoWords(word))
      .sort((a, b) => a.x - b.x)
    for (const word of words) {
      const value = word.str.trim()
      if (value === '') continue
      const column = columnForX(word.x, starts, slack)
      if (values[column] === '') values[column] = value
      // Words that touch belong to the same piece of writing; words with a gap
      // between them are separate words of the box.
      else if (word.x - lastEnd[column] <= 0.5) values[column] += value
      else values[column] += ` ${value}`
      lastEnd[column] = word.end
      if (!filled.includes(column)) filled.push(column)
    }
    if (filled.length === 0) continue

    // A line written close under the row above, continuing a box that is
    // already open there, is a word that was wrapped inside that box. A line
    // that starts a new value in the first column is a new row, not a wrap -
    // even when the rows below each other fill the same boxes.
    const row = current
    const gap = row && row.page === entry.line.page ? row.y - entry.line.y : Number.POSITIVE_INFINITY
    const continuesRow =
      row !== null &&
      gap <= 1.25 * Math.max(row.height, entry.height) &&
      filled.every((column) => row.values[column] !== '') &&
      (values[0] === '' || filled.length === 1)

    if (continuesRow && row) {
      for (const column of filled) {
        row.values[column] = `${row.values[column]} ${values[column]}`
      }
      row.y = entry.line.y
      row.height = entry.height
      continue
    }

    finishRow()
    current = { page: entry.line.page, y: entry.line.y, height: entry.height, values }
  }
  finishRow()

  if (rows.length === 0) {
    throw new NoTableError('Nothing was found under the headings in this PDF, so there are no rows to import.')
  }

  const columns = names.map((name, index) => ({
    name,
    type: detectColumnType(
      name,
      rows.map((row) => row[index] ?? ''),
    ),
  }))
  return { columns, rows }
}
