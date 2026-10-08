/**
 * utils/totals.ts
 * ---------------
 * All the maths. Everything here ignores empty boxes, so blank rows never break
 * a total.
 *
 * Rules the user asked for:
 *   - A "TOTALS PER COLUMN" line adds up every Amount and every Quantity column.
 *   - A "GRAND TOTAL" line adds up the Amount columns only.
 *     Quantity columns (litres, trips, ...) are deliberately left out of it.
 */

import type { CellValue, Column, Row, SheetDocument } from '../types'
import { cellToList, cellToText, dateSortNumber, formatNumber, parseNumber } from './format'
import { isSameWord } from './normalize'

/** What we show in the totals lines under the table. */
export interface TotalsResult {
  /** A number for every Amount and Quantity column. Null for the other columns. */
  perColumn: Record<string, number | null>
  /**
   * The grand total. It adds up the Amount columns only, which is what the user
   * means by "the total of all the money".
   */
  grandTotal: number
  /** How many rows have something typed in them. */
  filledRowCount: number
  /** How many rows are in the table (after any filter). */
  visibleRowCount: number
  /** True when the document has at least one Amount column. */
  hasAmountColumns: boolean
  /** Columns that are added up, in the order they appear in the table. */
  summedColumns: Column[]
}

/** The totals for a set of rows. Pass the filtered rows so the PDF matches the screen. */
export function calculateTotals(columns: Column[], rows: Row[]): TotalsResult {
  const perColumn: Record<string, number | null> = {}
  const summedColumns: Column[] = []
  let grandTotal = 0
  let hasAmountColumns = false
  let filledRowCount = 0

  for (const column of columns) {
    perColumn[column.id] = null
    if (column.type !== 'amount' && column.type !== 'quantity') continue
    summedColumns.push(column)

    let sum = 0
    for (const row of rows) {
      const value = row.values[column.id]
      if (cellToText(value).trim() === '') continue // an empty box adds nothing
      sum += parseNumber(value)
    }
    perColumn[column.id] = sum

    // Only Amount money columns go into the grand total.
    if (column.type === 'amount') {
      hasAmountColumns = true
      grandTotal += sum
    }
  }

  for (const row of rows) {
    const hasSomething = columns.some((column) => cellToText(row.values[column.id]).trim() !== '')
    if (hasSomething) filledRowCount += 1
  }

  return {
    perColumn,
    grandTotal,
    filledRowCount,
    visibleRowCount: rows.length,
    hasAmountColumns,
    summedColumns,
  }
}

/**
 * The text shown in a totals cell. Normally the summed number, but a quantity
 * column can be set to show "how many rows were filled in" instead of a sum,
 * which is handy for columns like "Number of Trips".
 */
export function totalsCellText(column: Column, rows: Row[], totals: TotalsResult): string {
  if (column.type === 'quantity' && column.countRows) {
    return String(countFilled(rows, column.id))
  }
  const value = totals.perColumn[column.id]
  if (value === null) return ''
  return formatNumber(value)
}

/** How many rows have something typed in a column. */
export function countFilled(rows: Row[], columnId: string): number {
  let count = 0
  for (const row of rows) {
    const value = row.values[columnId]
    if (Array.isArray(value)) {
      if (value.length > 0) count += 1
    } else if (String(value ?? '').trim() !== '') {
      count += 1
    }
  }
  return count
}

/** How many lines one cell covers when "Group rows" is switched on. */
export interface GroupInfo {
  [columnId: string]: number
}

/**
 * Works out which cells can be merged.
 *
 * With "Group rows" switched on, a value that is the same as the value below it
 * is shown once and stretched down, so a driver with three rows shows the driver
 * name only on the first line. Amount and quantity columns are never merged,
 * because each row has its own money or litres in it.
 */
export function calculateGroups(columns: Column[], rows: Row[]): GroupInfo[] {
  return rows.map((row, rowIndex) => {
    const info: GroupInfo = {}
    for (const column of columns) {
      if (column.type === 'amount' || column.type === 'quantity') {
        info[column.id] = 1
        continue
      }
      const mine = cellToText(row.values[column.id]).trim()
      if (mine === '') {
        info[column.id] = 1 // an empty box is never merged
        continue
      }
      let span = 1
      // Look ahead while the rows below hold exactly the same words.
      while (rowIndex + span < rows.length) {
        const next = rows[rowIndex + span].values[column.id]
        if (!isSameWord(mine, cellToText(next))) break
        span += 1
      }
      info[column.id] = span
    }
    return info
  })
}

/** Adds up every amount column of one row. Shown as a small hint, not a column. */
export function rowAmountTotal(columns: Column[], row: Row): number {
  let total = 0
  for (const column of columns) {
    if (column.type !== 'amount') continue
    total += parseNumber(row.values[column.id])
  }
  return total
}

/** A filter chosen by the user, e.g. "only rows with truck T715 EQQ". */
export interface RowFilter {
  columnId: string
  value: string
}

/** Keeps only the rows that match every filter. */
export function filterRows(rows: Row[], filters: RowFilter[]): Row[] {
  const active = filters.filter((filter) => filter.value.trim() !== '')
  if (active.length === 0) return rows
  return rows.filter((row) =>
    active.every((filter) => {
      const cell = row.values[filter.columnId] as CellValue
      const options = cellToList(cell)
      if (options.length > 0) return options.some((option) => isSameWord(option, filter.value))
      return isSameWord(cellToText(cell), filter.value)
    }),
  )
}

/** Sorts a copy of the rows for showing only - the saved order never changes. */
export function sortRows(
  rows: Row[],
  sortMode: SheetDocument['settings']['sortMode'],
  columns: Column[],
): Row[] {
  if (sortMode === 'none') return rows
  const dateColumn = columns.find((column) => column.type === 'date')
  if (!dateColumn) return rows
  const direction = sortMode === 'date-asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = dateSortNumber(a.values[dateColumn.id])
    const right = dateSortNumber(b.values[dateColumn.id])
    return (left - right) * direction
  })
}
