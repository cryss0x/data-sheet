/**
 * storage/localStore.ts
 * ---------------------
 * The fallback way of saving, used when the browser cannot open folders
 * (Firefox, Safari and phones).
 *
 * Everything is kept inside the browser's own storage on this computer. Nothing
 * is sent anywhere. The user is told about it clearly, and is given two buttons:
 * "Save a backup file" and "Open a backup file", so the work can still be moved
 * between computers and kept safe.
 */

import { KEEP_VERSIONS } from '../constants'
import type { DocumentVersion, ListsFile, SheetDocument } from '../types'
import { formatDateTime } from '../utils/format'
import { documentText, fingerprint } from '../utils/hash'
import {
  deleteLocalDocument,
  readAllLocalDocuments,
  readLocalDocument,
  readLocalLists,
  readSetting,
  writeLocalDocument,
  writeLocalLists,
  writeSetting,
} from './idb'
import { isDocumentFile, isListsFile, normaliseDocument, normaliseListsFile } from './validate'
import type { Store, StoreContents, StoredDocument } from './types'

/** Older copies are kept together in one small record. */
const VERSIONS_KEY = 'versions'

/** Marks the document that could not be written to the folder earlier. */
export const PENDING_KEY = 'pending-push'

interface VersionIndexEntry {
  savedAt: string
  title: string
  rowCount: number
}

interface VersionsRecord {
  /** "documentId~time" -> a short description, used for the list on screen. */
  index: Record<string, VersionIndexEntry>
  /** "documentId~time" -> the whole document, so it can be brought back. */
  files: Record<string, SheetDocument>
}

async function readVersions(): Promise<VersionsRecord> {
  const record = await readSetting<VersionsRecord>(VERSIONS_KEY)
  return { index: record?.index ?? {}, files: record?.files ?? {} }
}

function versionKey(documentId: string, stamp: string): string {
  return `${documentId}~${stamp}`
}

export class LocalStore implements Store {
  readonly mode = 'browser' as const

  isConnected(): boolean {
    return true // the browser's own storage is always ready to use
  }

  async connect(): Promise<boolean> {
    return true
  }

  async disconnect(): Promise<void> {
    // Nothing to undo: the browser's storage is not "connected" to anything.
  }

  async readAll(): Promise<StoreContents> {
    const raw = await readAllLocalDocuments<unknown>()
    const documents: StoredDocument[] = []

    for (const item of raw) {
      if (!isDocumentFile(item)) continue
      const document = normaliseDocument(item)
      documents.push({
        fileName: `${document.id}.json`,
        lastModified: new Date(document.updatedAt).getTime(),
        signature: fingerprint(documentText(document)),
        document,
      })
    }

    const rawLists = await readLocalLists<unknown>()
    const lists: ListsFile = isListsFile(rawLists)
      ? normaliseListsFile(rawLists)
      : { kind: 'lists', version: 1, updatedAt: new Date().toISOString(), lists: [] }

    return { documents, lists, skippedFiles: [], locationName: 'This browser only' }
  }

  async writeDocument(document: SheetDocument): Promise<StoredDocument> {
    await writeLocalDocument(document.id, document)
    return {
      fileName: `${document.id}.json`,
      lastModified: new Date(document.updatedAt).getTime(),
      signature: fingerprint(documentText(document)),
      document,
    }
  }

  async deleteDocument(fileName: string): Promise<void> {
    // In browser mode the file name is the document id with ".json" added.
    await deleteLocalDocument(fileName.replace(/\.json$/i, ''))
  }

  async writeLists(lists: ListsFile): Promise<void> {
    await writeLocalLists(lists)
  }

  async listVersions(documentId: string): Promise<DocumentVersion[]> {
    const record = await readVersions()
    return Object.entries(record.index)
      .filter(([key]) => key.startsWith(`${documentId}~`))
      .map(([key, info]) => {
        const stamp = key.slice(documentId.length + 1)
        return {
          stamp,
          savedAt: info.savedAt,
          fileName: stamp,
          title: info.title,
          rowCount: info.rowCount,
        }
      })
      .sort((a, b) => Number(b.stamp) - Number(a.stamp))
  }

  async readVersion(stamp: string): Promise<SheetDocument | null> {
    const record = await readVersions()
    const found = Object.entries(record.files).find(([key]) => key.endsWith(`~${stamp}`))
    return found ? normaliseDocument(found[1]) : null
  }

  async writeVersion(document: SheetDocument): Promise<void> {
    const record = await readVersions()
    const stamp = String(Date.now())
    const key = versionKey(document.id, stamp)

    record.index[key] = { savedAt: new Date().toISOString(), title: document.title, rowCount: document.rows.length }
    record.files[key] = document

    // Keep only the newest few copies, so browser storage does not grow forever.
    const stamps = Object.keys(record.index)
      .filter((item) => item.startsWith(`${document.id}~`))
      .map((item) => item.slice(document.id.length + 1))
      .sort((a, b) => Number(b) - Number(a))

    for (const old of stamps.slice(KEEP_VERSIONS)) {
      delete record.index[versionKey(document.id, old)]
      delete record.files[versionKey(document.id, old)]
    }

    await writeSetting(VERSIONS_KEY, record)
  }

  /** Reads one document from the browser's own copy. */
  async readDocument(documentId: string): Promise<SheetDocument | null> {
    const stored = await readLocalDocument<unknown>(documentId)
    return isDocumentFile(stored) ? normaliseDocument(stored) : null
  }

  /** Notes that a document still has to be written to the folder. */
  async markPending(documentId: string, pending: boolean): Promise<void> {
    await writeSetting(PENDING_KEY, pending ? documentId : '')
  }

  /** Which document still has to be written to the folder. */
  async readPending(): Promise<string | null> {
    const value = await readSetting<string>(PENDING_KEY)
    return value && value !== '' ? value : null
  }
}

/** A version entry shown in the "Restore an earlier version" window. */
export function describeLocalVersion(version: DocumentVersion): string {
  const rows = `${version.rowCount} ${version.rowCount === 1 ? 'row' : 'rows'}`
  return `${formatDateTime(version.savedAt)} — ${rows}`
}
