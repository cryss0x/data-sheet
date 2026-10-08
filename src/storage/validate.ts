/**
 * storage/validate.ts
 * -------------------
 * Reading files that may have been made by this app, restored from a backup, or
 * hand-edited in a text editor. If a file does not look like a document we
 * quietly leave it alone, so nothing in the folder is ever damaged.
 */

import { DEFAULT_SETTINGS } from '../constants'
import type { CellValue, Column, ColumnType, ListsFile, Row, SheetDocument, SheetSettings } from '../types'
import { newId } from '../utils/id'

/** The column types this app understands. Anything else becomes "text". */
const COLUMN_TYPES: ColumnType[] = ['text', 'date', 'amount', 'quantity', 'pick', 'multi']

/** Does this file look like one of our documents? */
export function isDocumentFile(value: unknown): value is SheetDocument {
  if (typeof value !== 'object' || value === null) return false
  const file = value as Partial<SheetDocument>
  return Array.isArray(file.columns) && Array.isArray(file.rows) && typeof file.title === 'string'
}

/** Fills in anything a hand-edited file may be missing, so it always opens. */
export function normaliseDocument(raw: unknown): SheetDocument {
  const file = (raw ?? {}) as Partial<SheetDocument>
  const now = new Date().toISOString()
  const settings: SheetSettings = { ...DEFAULT_SETTINGS, ...(file.settings ?? {}) }
  const columns = normaliseColumns(file.columns)

  return {
    id: typeof file.id === 'string' && file.id !== '' ? file.id : newId('doc'),
    title: typeof file.title === 'string' && file.title.trim() !== '' ? file.title : 'Untitled document',
    subtitle: typeof file.subtitle === 'string' ? file.subtitle : '',
    createdAt: typeof file.createdAt === 'string' ? file.createdAt : now,
    updatedAt: typeof file.updatedAt === 'string' ? file.updatedAt : now,
    columns,
    // Values that belong to a column which no longer exists are dropped here.
    rows: normaliseRows(file.rows, columns),
    settings,
  }
}

/** Cleans the list of columns, keeping unknown ones as simple text. */
export function normaliseColumns(raw: unknown): Column[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const columns: Column[] = []

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const column = item as Partial<Column>
    const name = typeof column.name === 'string' ? column.name.trim() : ''
    if (name === '') continue

    const type = COLUMN_TYPES.includes(column.type as ColumnType) ? (column.type as ColumnType) : 'text'
    let id = typeof column.id === 'string' && column.id !== '' ? column.id : newId('col')
    while (seen.has(id)) id = newId('col')
    seen.add(id)

    const clean: Column = { id, name, type }
    if (typeof column.listName === 'string' && column.listName !== '') clean.listName = column.listName
    if (column.link && typeof column.link.listName === 'string' && typeof column.link.valueKey === 'string') {
      clean.link = { listName: column.link.listName, valueKey: column.link.valueKey }
    }
    if (column.countRows === true) clean.countRows = true
    columns.push(clean)
  }

  return columns
}

/** Cleans the list of rows, keeping only values that match a real column. */
export function normaliseRows(raw: unknown, columns: Column[] = []): Row[] {
  if (!Array.isArray(raw)) return []
  const validIds = new Set(columns.map((column) => column.id))
  const rows: Row[] = []

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const row = item as Partial<Row>
    const values: Record<string, CellValue> = {}

    if (typeof row.values === 'object' && row.values !== null) {
      for (const [columnId, value] of Object.entries(row.values)) {
        // A value for a column that no longer exists is simply dropped.
        if (columns.length > 0 && !validIds.has(columnId)) continue
        if (Array.isArray(value)) {
          values[columnId] = value.filter((part) => typeof part === 'string')
        } else if (typeof value === 'string' || typeof value === 'number') {
          values[columnId] = String(value)
        }
      }
    }

    rows.push({ id: typeof row.id === 'string' && row.id !== '' ? row.id : newId('row'), values })
  }

  return rows
}

/** Does this file look like the saved-lists file? */
export function isListsFile(value: unknown): value is ListsFile {
  if (typeof value !== 'object' || value === null) return false
  return Array.isArray((value as Partial<ListsFile>).lists)
}

/** Cleans the lists file. */
export function normaliseListsFile(raw: unknown): ListsFile {
  const file = (raw ?? {}) as Partial<ListsFile>
  const lists = Array.isArray(file.lists) ? file.lists : []

  return {
    kind: 'lists',
    version: 1,
    updatedAt: typeof file.updatedAt === 'string' ? file.updatedAt : new Date().toISOString(),
    lists: lists
      .filter((list): list is NonNullable<typeof list> => typeof list === 'object' && list !== null)
      .map((list) => ({
        name: typeof list.name === 'string' ? list.name : 'List',
        items: Array.isArray(list.items)
          ? list.items
              .filter((item): item is NonNullable<typeof item> => typeof item === 'object' && item !== null)
              .map((item) => ({
                value: typeof item.value === 'string' ? item.value : String(item.value ?? ''),
                linked:
                  typeof item.linked === 'object' && item.linked !== null
                    ? Object.fromEntries(
                        Object.entries(item.linked as Record<string, unknown>).map(([key, value]) => [
                          key,
                          String(value ?? ''),
                        ]),
                      )
                    : {},
              }))
              .filter((item) => item.value.trim() !== '')
          : [],
      }))
      .filter((list) => list.name.trim() !== ''),
  }
}

/** Turns text into a document. Used by "Open a backup file". */
export function parseDocumentJson(text: string): SheetDocument {
  const parsed: unknown = JSON.parse(text)
  if (!isDocumentFile(parsed)) {
    throw new Error('That file is not a data sheet document.')
  }
  return normaliseDocument(parsed)
}

/** Turns text into the saved lists. */
export function parseListsJson(text: string): ListsFile {
  const parsed: unknown = JSON.parse(text)
  if (!isListsFile(parsed)) {
    throw new Error('That file is not a saved lists file.')
  }
  return normaliseListsFile(parsed)
}
