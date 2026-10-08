/**
 * storage/types.ts
 * ---------------
 * The "shape" of the saving system.
 *
 * There are two ways of saving, and both of them do exactly the same job, so the
 * rest of the app does not need to know which one is in use:
 *
 *   FolderStore  - one .json file per document inside the folder the user chose.
 *                  The folder is the true home of the work.
 *   LocalStore   - everything stays inside the browser. Used on Firefox, Safari
 *                  and phones, where the browser cannot open folders.
 */

import type { DocumentVersion, ListsFile, SheetDocument, StorageMode } from '../types'

/** A document together with the file it lives in. */
export interface StoredDocument {
  /** The file name, for example "TOTAL EXPENSES OF KBL TRUCKS SEPTEMBER.json". */
  fileName: string
  /** The time the file was last changed on disk. */
  lastModified: number
  /**
   * A short fingerprint of the exact text of the file. When this changes, the
   * file was written outside the app.
   */
  signature: string
  document: SheetDocument
}

/** What we get back when we look at the whole folder. */
export interface StoreContents {
  documents: StoredDocument[]
  lists: ListsFile
  /** Files that were there but are not documents, so they were left alone. */
  skippedFiles: string[]
  /** The name of the folder, for showing to the user. */
  locationName: string
}

/** The list of things any saving method must be able to do. */
export interface Store {
  readonly mode: StorageMode
  /** True when the app can read and write the place where the work is kept. */
  isConnected(): boolean
  /**
   * Asks the user to allow access, if that is needed.
   * Returns true when the app can go ahead.
   */
  connect(): Promise<boolean>
  /** Forgets the chosen folder (the files themselves are never touched). */
  disconnect(): Promise<void>
  /** Reads everything: all documents, the saved lists, and any files to skip. */
  readAll(): Promise<StoreContents>
  /**
   * Saves one document. Pass the previous file name when a document was renamed,
   * so the old file can be tidied up. Returns the file name now in use.
   */
  writeDocument(document: SheetDocument, previousFileName?: string | null): Promise<StoredDocument>
  /** Removes one document file. */
  deleteDocument(fileName: string): Promise<void>
  /** Saves the lists file. */
  writeLists(lists: ListsFile): Promise<void>
  /** Lists the older copies of a document, newest first. */
  listVersions(documentId: string): Promise<DocumentVersion[]>
  /** Reads one older copy. */
  readVersion(fileName: string): Promise<SheetDocument | null>
  /** Keeps one older copy of a document. */
  writeVersion(document: SheetDocument): Promise<void>
}

/** Is this browser able to open folders? (Chrome and Edge on a computer can.) */
export function supportsFolders(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

/** Turns a low-level error into a friendly sentence with no technical words. */
export function friendlyError(error: unknown, fallback: string): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'The browser did not allow access to your folder. Click the reconnect button and choose the same folder again.'
  }
  if (name === 'NotFoundError') {
    return 'That folder or file could not be found. Choose your folder again.'
  }
  if (name === 'QuotaExceededError') {
    return 'This computer is out of space. Delete something you no longer need, or save a backup file, then try again.'
  }
  if (name === 'TypeError') {
    return 'That file could not be read as a data sheet file. Nothing was changed.'
  }
  if (error instanceof Error && error.message) return `${fallback} (${error.message})`
  return fallback
}
