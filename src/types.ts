/**
 * types.ts
 * ---------
 * The "shape" of everything this app saves.
 *
 * A DOCUMENT is one sheet the user makes (for example "TOTAL EXPENSES OF KBL
 * TRUCKS SEPTEMBER"). It has a title, a list of COLUMNS (the headings) and a
 * list of ROWS (one per detail entered).
 *
 * A CELL VALUE is what the user typed in one box. It is text, except for a
 * "Pick several from list" column, where it is a small list of words.
 */

export type ColumnType =
  | 'text' // any words
  | 'date' // a date, but free words such as "July 2026" are allowed too
  | 'amount' // money - added into the grand total
  | 'quantity' // a number such as litres or trips - totalled but NOT in the grand total
  | 'pick' // dropdown list of saved words
  | 'multi' // one cell can hold several words, shown as small tags

/**
 * A link means: "when I choose a value in the column that uses this list, fill
 * this column in automatically". For example choosing truck "T715EQQ" fills the
 * Driver Name column with the driver saved with that truck.
 */
export interface ColumnLink {
  /** The list the value is looked up in (for example the Trucks list). */
  listName: string
  /** The name of the saved extra value to copy in (for example "Driver Name"). */
  valueKey: string
}

export interface Column {
  id: string
  name: string
  type: ColumnType
  /** Which saved list a "Pick from list" / "Pick several from list" column uses. */
  listName?: string
  /** Optional: fill this column automatically from the saved list. */
  link?: ColumnLink
  /**
   * Quantity columns only: show "how many rows were filled in" instead of a sum.
   * Useful for columns like "Number of Trips" where a count is what you want.
   */
  countRows?: boolean
}

/** One cell. Either plain text, or several words for a "multi" column. */
export type CellValue = string | string[]

export interface Row {
  id: string
  /** The values of this row, stored by column id. */
  values: Record<string, CellValue>
}

export interface SheetSettings {
  /** Show repeated values (SN, Driver, Truck) only once, merged down the group. */
  groupRows: boolean
  /** Keep the date in the entry form after adding a row. */
  keepDate: boolean
  /** Copy the previous row's words into the form after adding a row. */
  repeatLast: boolean
  /** Show a "how many rows in total" line under the table. */
  showRowCount: boolean
  /** How the table is shown (the saved order is never changed). */
  sortMode: 'none' | 'date-asc' | 'date-desc'
}

export interface SheetDocument {
  id: string
  title: string
  subtitle: string
  /** ISO date-time strings, e.g. "2026-09-30T10:42:00.000Z" */
  createdAt: string
  updatedAt: string
  columns: Column[]
  rows: Row[]
  settings: SheetSettings
}

/** One saved word in a list, plus any extra words linked to it. */
export interface ListItem {
  value: string
  /** Extra saved words, e.g. { "Driver Name": "RAMADHAN HASSAN MJATA" } */
  linked: Record<string, string>
}

/** A saved list of words, for example "Trucks" or "Descriptions". */
export interface SavedList {
  name: string
  items: ListItem[]
}

/** The single file that holds every saved list. */
export interface ListsFile {
  kind: 'lists'
  version: 1
  updatedAt: string
  lists: SavedList[]
}

/** One older copy of a document, kept so a mistake can be undone. */
export interface DocumentVersion {
  /** Sort key: the time the copy was taken. */
  stamp: string
  /** The time it was taken, shown to the user as a date and clock time. */
  savedAt: string
  fileName: string
  title: string
  rowCount: number
}

/** Everything written into one "back up everything" file. */
export interface BackupFile {
  kind: 'backup'
  version: 1
  createdAt: string
  documents: SheetDocument[]
  lists: ListsFile
}

/** How the app is currently storing the user's work. */
export type StorageMode =
  | 'folder' // saved as .json files in a folder the user chose
  | 'browser' // saved inside the browser only (fallback when folders are not available)

/** The small "Saved / Saving" message shown next to the document title. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
