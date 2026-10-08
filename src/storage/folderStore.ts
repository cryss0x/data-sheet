/**
 * storage/folderStore.ts
 * ----------------------
 * Saving every document as its own .json file inside the folder the user chose.
 *
 * This is the main way of saving, and it has two big advantages:
 *   - the files are the real thing: the user can see them, copy them, and open
 *     them on another computer,
 *   - the app can watch the folder, so a file deleted, added or changed outside
 *     the app shows up straight away.
 *
 * The browser feature used here is called the "File System Access API". It only
 * works in Chrome and Edge, over a secure address (https, or localhost).
 */

import { HISTORY_FOLDER, KEEP_VERSIONS, LISTS_FILE } from '../constants'
import type { DocumentVersion, ListsFile, SheetDocument } from '../types'
import { formatDateTime, safeFileName, titleFromFileName, uniqueFileName } from '../utils/format'
import { documentText, fingerprint } from '../utils/hash'
import { readSetting, writeSetting } from './idb'
import { isDocumentFile, isListsFile, normaliseDocument, normaliseListsFile } from './validate'
import type { Store, StoreContents, StoredDocument } from './types'

/** The key used to remember the chosen folder. */
const HANDLE_KEY = 'chosen-folder'

/** An empty lists file, used when the folder does not have one yet. */
function emptyLists(): ListsFile {
  return { kind: 'lists', version: 1, updatedAt: new Date().toISOString(), lists: [] }
}

export class FolderStore implements Store {
  readonly mode = 'folder' as const

  /** The folder the user chose, held in memory while the app is open. */
  private handle: FileSystemDirectoryHandle | null = null

  /** The file name of each document, so we can find it again and rename it. */
  private fileNames = new Map<string, string>()

  /** Picks up the folder remembered from a previous visit. */
  async restoreRememberedFolder(): Promise<void> {
    const handle = await readSetting<FileSystemDirectoryHandle>(HANDLE_KEY)
    if (handle) this.handle = handle
  }

  isConnected(): boolean {
    return this.handle !== null
  }

  /** Asks the browser for the folder window and stores the choice. */
  async chooseFolder(): Promise<boolean> {
    const handle = await window.showDirectoryPicker({ id: 'data-sheet-folder', mode: 'readwrite' })
    this.handle = handle
    await writeSetting(HANDLE_KEY, handle)
    return true
  }

  /**
   * Browsers forget the permission when the browser is closed, so we check it
   * and ask the user to click a button if permission is needed.
   */
  async connect(): Promise<boolean> {
    if (!this.handle) return false
    const permission = await this.checkPermission(this.handle, false)
    if (permission === 'granted') return true
    const asked = await this.checkPermission(this.handle, true)
    return asked === 'granted'
  }

  private async checkPermission(
    handle: FileSystemDirectoryHandle,
    ask: boolean,
  ): Promise<PermissionState> {
    if (typeof handle.queryPermission !== 'function') return 'granted'
    if (ask && typeof handle.requestPermission === 'function') {
      return handle.requestPermission({ mode: 'readwrite' })
    }
    return handle.queryPermission({ mode: 'readwrite' })
  }

  async disconnect(): Promise<void> {
    this.handle = null
    this.fileNames.clear()
  }

  /** Reads one file as text, together with the time it was last changed. */
  private async readTextFile(fileName: string): Promise<{ text: string; lastModified: number } | null> {
    if (!this.handle) return null
    try {
      const fileHandle = await this.handle.getFileHandle(fileName)
      const file = await fileHandle.getFile()
      return { text: await file.text(), lastModified: file.lastModified }
    } catch {
      // A file that cannot be read is treated as if it were not there.
      return null
    }
  }

  /** Writes one file as text. */
  private async writeTextFile(fileName: string, text: string): Promise<number> {
    if (!this.handle) throw new Error('No folder has been chosen yet.')
    const fileHandle = await this.handle.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    try {
      await writable.write(text)
    } finally {
      await writable.close()
    }
    const file = await fileHandle.getFile()
    return file.lastModified
  }

  /** The folder holding the older copies, created the first time it is needed. */
  private async historyFolder(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.handle) return null
    try {
      return await this.handle.getDirectoryHandle(HISTORY_FOLDER, { create: true })
    } catch {
      return null
    }
  }

  async readAll(): Promise<StoreContents> {
    if (!this.handle) {
      return { documents: [], lists: emptyLists(), skippedFiles: [], locationName: '' }
    }

    const documents: StoredDocument[] = []
    const skippedFiles: string[] = []
    let lists = emptyLists()
    this.fileNames.clear()

    for await (const [name, entry] of iterate(this.handle)) {
      if (entry.kind !== 'file') continue // the _history folder is handled separately
      if (!name.toLowerCase().endsWith('.json')) continue

      const file = await this.readTextFile(name)
      if (!file) continue

      if (name === LISTS_FILE) {
        try {
          const parsed: unknown = JSON.parse(file.text)
          if (isListsFile(parsed)) lists = normaliseListsFile(parsed)
        } catch {
          // A broken lists file is ignored so the app still opens.
        }
        continue
      }

      try {
        const parsed: unknown = JSON.parse(file.text)
        if (!isDocumentFile(parsed)) {
          skippedFiles.push(name)
          continue
        }
        const document = normaliseDocument(parsed)
        // A file without a title inside still shows under its file name.
        if (document.title === 'Untitled document' && (parsed as { title?: string }).title === undefined) {
          document.title = titleFromFileName(name)
        }
        this.fileNames.set(document.id, name)
        documents.push({ fileName: name, lastModified: file.lastModified, signature: fingerprint(file.text), document })
      } catch {
        skippedFiles.push(name)
      }
    }

    return {
      documents,
      lists,
      skippedFiles,
      locationName: this.handle.name,
    }
  }

  async writeDocument(document: SheetDocument, previousFileName?: string | null): Promise<StoredDocument> {
    if (!this.handle) throw new Error('No folder has been chosen yet.')

    // Pick the file name from the title, and make sure it is not already used by
    // another document.
    const wanted = safeFileName(document.title)
    const others = new Set<string>()
    for (const [id, name] of this.fileNames) {
      if (id !== document.id) others.add(name)
    }
    const fileName = `${uniqueFileName(wanted, others)}.json`

    const text = documentText(document)
    const lastModified = await this.writeTextFile(fileName, text)

    // A renamed document leaves an old file behind, so tidy it up.
    if (previousFileName && previousFileName !== fileName) {
      await this.deleteFile(previousFileName)
    }

    this.fileNames.set(document.id, fileName)
    return { fileName, lastModified, signature: fingerprint(text), document }
  }

  private async deleteFile(fileName: string): Promise<void> {
    if (!this.handle) return
    try {
      await this.handle.removeEntry(fileName)
    } catch {
      // If the file is already gone, there is nothing to do.
    }
  }

  async deleteDocument(fileName: string): Promise<void> {
    await this.deleteFile(fileName)
    for (const [id, name] of this.fileNames) {
      if (name === fileName) this.fileNames.delete(id)
    }
  }

  async writeLists(lists: ListsFile): Promise<void> {
    await this.writeTextFile(LISTS_FILE, JSON.stringify(lists, null, 2))
  }

  async listVersions(documentId: string): Promise<DocumentVersion[]> {
    const folder = await this.historyFolder()
    if (!folder) return []
    const versions: DocumentVersion[] = []

    for await (const [name, entry] of iterate(folder)) {
      if (entry.kind !== 'file' || !name.endsWith('.json')) continue
      // Version files are named "<document id>--<time>.json".
      if (!name.startsWith(`${documentId}--`)) continue
      const stamp = name.slice(documentId.length + 2, name.length - '.json'.length)
      const savedAt = new Date(Number(stamp)).toISOString()
      let rowCount = 0
      let title = ''
      const text = await this.readHistoryText(folder, name)
      if (text) {
        try {
          const parsed: unknown = JSON.parse(text)
          if (isDocumentFile(parsed)) {
            rowCount = Array.isArray(parsed.rows) ? parsed.rows.length : 0
            title = typeof parsed.title === 'string' ? parsed.title : ''
          }
        } catch {
          // A broken older copy is skipped.
        }
      }
      versions.push({ stamp, savedAt, fileName: name, title, rowCount })
    }

    return versions.sort((a, b) => Number(b.stamp) - Number(a.stamp))
  }

  private async readHistoryText(folder: FileSystemDirectoryHandle, name: string): Promise<string | null> {
    try {
      const fileHandle = await folder.getFileHandle(name)
      return await (await fileHandle.getFile()).text()
    } catch {
      return null
    }
  }

  async readVersion(fileName: string): Promise<SheetDocument | null> {
    const folder = await this.historyFolder()
    if (!folder) return null
    const text = await this.readHistoryText(folder, fileName)
    if (!text) return null
    try {
      const parsed: unknown = JSON.parse(text)
      return isDocumentFile(parsed) ? normaliseDocument(parsed) : null
    } catch {
      return null
    }
  }

  async writeVersion(document: SheetDocument): Promise<void> {
    const folder = await this.historyFolder()
    if (!folder) return

    // One copy every few minutes is plenty, so quick typing does not fill the
    // folder with copies.
    const stamp = Date.now()
    const fileName = `${document.id}--${stamp}.json`
    try {
      const fileHandle = await folder.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      try {
        await writable.write(documentText(document))
      } finally {
        await writable.close()
      }
    } catch {
      return
    }

    // Keep only the newest few copies, so the folder does not grow forever.
    const versions = await this.listVersions(document.id)
    for (const old of versions.slice(KEEP_VERSIONS)) {
      try {
        await folder.removeEntry(old.fileName)
      } catch {
        // Nothing to do.
      }
    }
  }

  /** The file name a document is stored in, or null if it is not stored here. */
  fileNameOf(documentId: string): string | null {
    return this.fileNames.get(documentId) ?? null
  }

  /** Remembers a file name after a document came back from the folder. */
  rememberFileName(documentId: string, fileName: string): void {
    this.fileNames.set(documentId, fileName)
  }
}

/** Walks the entries of a folder. Very small stand-in for a missing method. */
async function* iterate(
  folder: FileSystemDirectoryHandle,
): AsyncGenerator<[string, FileSystemHandle], void, undefined> {
  const iterable = folder as unknown as {
    entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>
    values?: () => AsyncIterableIterator<FileSystemHandle>
  }

  if (typeof iterable.entries === 'function') {
    for await (const entry of iterable.entries()) yield entry
    return
  }
  if (typeof iterable.values === 'function') {
    for await (const handle of iterable.values()) yield [handle.name, handle]
  }
}

/** A version entry shown in the "Restore an earlier version" window. */
export function describeVersion(version: DocumentVersion): string {
  const rows = `${version.rowCount} ${version.rowCount === 1 ? 'row' : 'rows'}`
  return `${formatDateTime(version.savedAt)} — ${rows}`
}
