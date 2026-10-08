/**
 * utils/download.ts
 * -----------------
 * Saving a file to the computer's usual "Downloads" folder, and choosing a file
 * to open. Both use ordinary browser features.
 */

import type { BackupFile } from '../types'
import { parseDocumentJson, parseListsJson } from '../storage/validate'

/** Saves some text as a file on the computer. */
export function downloadTextFile(fileName: string, text: string, kind = 'application/json'): void {
  const blob = new Blob([text], { type: `${kind};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before cleaning up.
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000)
}

/** Opens the usual "choose a file" window and gives back the file that was chosen. */
export function chooseFileToOpen(accept = '.json,application/json'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    document.body.appendChild(input)

    let finished = false
    const finish = (file: File | null) => {
      if (finished) return
      finished = true
      input.remove()
      resolve(file)
    }

    input.addEventListener('change', () => finish(input.files?.[0] ?? null))
    // If the window is closed without choosing, nothing happens.
    input.addEventListener('cancel', () => finish(null))
    input.click()
  })
}

/** Reads a chosen file as text. */
export async function readFileAsText(file: File): Promise<string> {
  return await file.text()
}

/** Puts every document and every list into one file. */
export function buildBackupFile(
  documents: BackupFile['documents'],
  lists: BackupFile['lists'],
): BackupFile {
  return {
    kind: 'backup',
    version: 1,
    createdAt: new Date().toISOString(),
    documents,
    lists,
  }
}

/** Turns the text of a backup file into documents and lists. */
export function parseBackupFile(text: string): BackupFile {
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('That file is not a backup made by this app.')
  }
  const file = parsed as Partial<BackupFile>
  if (!Array.isArray(file.documents)) {
    throw new Error('That file is not a backup made by this app.')
  }
  return {
    kind: 'backup',
    version: 1,
    createdAt: typeof file.createdAt === 'string' ? file.createdAt : new Date().toISOString(),
    documents: file.documents,
    lists: file.lists ?? { kind: 'lists', version: 1, updatedAt: new Date().toISOString(), lists: [] },
  }
}

/** Turns the text of a single document file into a document. */
export function parseDocumentText(text: string) {
  return parseDocumentJson(text)
}

/** Turns the text of a lists file into lists. */
export function parseListsText(text: string) {
  return parseListsJson(text)
}

/** The file name used for the "back up everything" file. */
export function backupFileName(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `data-sheet-backup-${today}.json`
}
