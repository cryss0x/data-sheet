/**
 * hooks/useAppStore.ts
 * --------------------
 * The heart of the app. It holds every document, saves changes automatically, and
 * keeps the chosen folder in step with what is on screen.
 *
 * How saving works, in plain words:
 *   - The user types. Nothing else happens yet.
 *   - About one second after the last keystroke the document is written to its
 *     file. The small status next to the title says "Saving..." and then
 *     "Saved 10:42".
 *   - Every few minutes an older copy is kept, so a mistake can be undone.
 *   - A spare copy is kept in the browser too, in case something goes wrong.
 *   - Every 10 seconds the folder is looked at. A file that was deleted, added or
 *     changed outside the app is picked up straight away.
 *
 * The files in the chosen folder are the real home of the work. The copy in the
 * browser's storage is only a spare, which is why the app can be opened on
 * another computer, pick the same folder, and find everything again.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AUTOSAVE_DELAY_MS, STARTER_LISTS, SYNC_INTERVAL_MS } from '../constants'
import { FolderStore } from '../storage/folderStore'
import { LocalStore } from '../storage/localStore'
import { readLocalDocument, writeLocalDocument, writeLocalLists } from '../storage/idb'
import type { Store, StoredDocument } from '../storage/types'
import { friendlyError, supportsFolders } from '../storage/types'
import type { Column, DocumentVersion, ListsFile, Row, SaveState, SheetDocument, StorageMode } from '../types'
import {
  backupFileName,
  buildBackupFile,
  chooseFileToOpen,
  downloadTextFile,
  parseBackupFile,
  readFileAsText,
} from '../utils/download'
import { newId } from '../utils/id'
import { isSameWord } from '../utils/normalize'

/** How often an older copy is kept. */
const VERSION_INTERVAL_MS = 5 * 60 * 1000

/** A big red message, or a small blue note. */
export interface AppAlert {
  title: string
  message: string
  tone: 'error' | 'info'
}

/** A question about a document that was changed outside the app. */
export interface ConflictInfo {
  documentId: string
  fileName: string
  signature: string
  document: SheetDocument
}

export interface AppStore {
  documents: SheetDocument[]
  fileNames: Record<string, string>
  lists: ListsFile
  mode: StorageMode
  connected: boolean
  foldersSupported: boolean
  locationName: string
  loading: boolean
  saveState: SaveState
  lastSavedAt: string | null
  unsaved: boolean
  alert: AppAlert | null
  skippedFiles: string[]
  conflict: ConflictInfo | null

  /** Remembers which document is on screen, so changes to it can be handled. */
  setOpenDocument: (id: string | null) => void
  connectFolder: () => Promise<void>
  disconnectFolder: () => Promise<void>
  refreshFromFolder: () => Promise<void>

  createDocument: (document: SheetDocument) => Promise<SheetDocument>
  updateDocument: (id: string, change: (document: SheetDocument) => SheetDocument) => void
  addRow: (id: string, row: Row) => void
  updateRow: (id: string, rowId: string, values: Row['values']) => void
  deleteRow: (id: string, rowId: string) => { row: Row; index: number } | null
  undoDeleteRow: (id: string, row: Row, index: number) => void
  duplicateRow: (id: string, rowId: string) => void
  setColumns: (id: string, columns: Column[]) => void
  setSettings: (id: string, settings: Partial<SheetDocument['settings']>) => void
  deleteDocument: (id: string) => Promise<void>
  saveOneDocument: (id: string) => void

  saveLists: (lists: ListsFile) => void
  addListValue: (listName: string, value: string) => void

  listVersions: (id: string) => Promise<DocumentVersion[]>
  restoreVersion: (id: string, stamp: string) => Promise<void>
  saveVersionNow: (id: string) => Promise<void>

  backupEverything: () => void
  restoreFromBackup: () => Promise<{ documents: number } | null>
  setAlert: (alert: AppAlert | null) => void
  resolveConflict: (choice: 'load' | 'keep') => void
}

/** The lists shown before the real ones are found. */
function starterLists(): ListsFile {
  return { kind: 'lists', version: 1, updatedAt: new Date().toISOString(), lists: STARTER_LISTS }
}

export function useAppStore(): AppStore {
  // ----------------------------------------------------------------- the state
  const [documents, setDocuments] = useState<SheetDocument[]>([])
  const [fileNames, setFileNames] = useState<Record<string, string>>({})
  const [lists, setLists] = useState<ListsFile>(starterLists)
  const [mode, setMode] = useState<StorageMode>('folder')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [unsaved, setUnsaved] = useState(false)
  const [alert, setAlert] = useState<AppAlert | null>(null)
  const [skippedFiles, setSkippedFiles] = useState<string[]>([])
  const [locationName, setLocationName] = useState('')
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)

  const foldersSupported = useMemo(() => supportsFolders(), [])

  // The two ways of saving. Only the chosen one is used.
  const folderStore = useMemo(() => new FolderStore(), [])
  const localStore = useMemo(() => new LocalStore(), [])
  const store: Store = mode === 'folder' ? folderStore : localStore

  // A copy of the documents that is always up to date, so saving and folder
  // checks never read stale values.
  const documentsRef = useRef<SheetDocument[]>([])
  const listsRef = useRef<ListsFile>(lists)
  const fileNamesRef = useRef<Record<string, string>>({})

  // The document that is open on screen.
  const openDocumentId = useRef<string | null>(null)

  /**
   * A short "fingerprint" of the exact text of each file we know about. When the
   * fingerprint in the folder is different, something changed outside the app.
   */
  const signatures = useRef<Record<string, string>>({})

  // The time of the last older copy we kept, for each document.
  const lastVersionAt = useRef<Record<string, number>>({})

  // The document waiting to be saved, and the timer that will save it.
  const pendingSave = useRef<{ id: string; timer: number } | null>(null)

  // True while a file is being written, so a folder check waits its turn.
  const savingNow = useRef(false)

  const setOpenDocument = useCallback((id: string | null) => {
    openDocumentId.current = id
  }, [])

  // ------------------------------------------------------------------ saving

  /** Writes one document to its file, and keeps a spare copy in the browser. */
  const writeOne = useCallback(
    async (document: SheetDocument, previousFileName?: string | null) => {
      savingNow.current = true
      try {
        const stored = await store.writeDocument(document, previousFileName)
        signatures.current[document.id] = stored.signature
        fileNamesRef.current[document.id] = stored.fileName
        setFileNames({ ...fileNamesRef.current })
        setSaveState('saved')
        setLastSavedAt(new Date().toISOString())
        setUnsaved(false)

        // A spare copy in the browser, so a crash cannot lose the work.
        await writeLocalDocument(document.id, document)

        // Keep an older copy now and then.
        const now = Date.now()
        if (now - (lastVersionAt.current[document.id] ?? 0) > VERSION_INTERVAL_MS) {
          lastVersionAt.current[document.id] = now
          await store.writeVersion(document)
        }
        return true
      } catch (error) {
        setSaveState('error')
        setUnsaved(true)
        setAlert({
          tone: 'error',
          title: 'This change could not be saved',
          message: `${friendlyError(
            error,
            'The file could not be written to your folder.',
          )} Your work is still safe in this browser - use "Back up everything" to keep a copy, then reconnect your folder.`,
        })
        return false
      } finally {
        savingNow.current = false
      }
    },
    [store],
  )

  /** Saves a document about a second after the last change. */
  const queueSave = useCallback(
    (id: string) => {
      setSaveState('saving')
      setUnsaved(true)
      if (pendingSave.current) window.clearTimeout(pendingSave.current.timer)
      const timer = window.setTimeout(() => {
        pendingSave.current = null
        const document = documentsRef.current.find((item) => item.id === id)
        if (!document) return
        void writeOne(document, fileNamesRef.current[id] ?? null)
      }, AUTOSAVE_DELAY_MS)
      pendingSave.current = { id, timer }
    },
    [writeOne],
  )

  // ------------------------------------------------------------- changing data

  /**
   * The one place documents are changed. Everything else calls this, so the
   * save timer and the spare copy are never forgotten.
   */
  const changeDocument = useCallback(
    (id: string, change: (document: SheetDocument) => SheetDocument) => {
      const current = documentsRef.current
      const index = current.findIndex((document) => document.id === id)
      if (index < 0) return

      const changed = change(current[index])
      if (changed === current[index]) return

      // A new "last changed" time, so the folder check can tell copies apart.
      changed.updatedAt = new Date().toISOString()

      const next = [...current]
      next[index] = changed
      documentsRef.current = next
      setDocuments(next)
      queueSave(id)
    },
    [queueSave],
  )

  const createDocument = useCallback(
    async (document: SheetDocument) => {
      const next = [document, ...documentsRef.current]
      documentsRef.current = next
      setDocuments(next)
      // The file is made straight away, so the title is never lost.
      await writeOne(document, null)
      return document
    },
    [writeOne],
  )

  const updateDocument = changeDocument

  const addRow = useCallback(
    (id: string, row: Row) => {
      changeDocument(id, (document) => ({ ...document, rows: [...document.rows, row] }))
    },
    [changeDocument],
  )

  const updateRow = useCallback(
    (id: string, rowId: string, values: Row['values']) => {
      changeDocument(id, (document) => ({
        ...document,
        rows: document.rows.map((row) => (row.id === rowId ? { ...row, values } : row)),
      }))
    },
    [changeDocument],
  )

  /** Removes a row and hands it back, so it can be put back with Undo. */
  const deleteRow = useCallback(
    (id: string, rowId: string) => {
      const document = documentsRef.current.find((item) => item.id === id)
      if (!document) return null
      const index = document.rows.findIndex((row) => row.id === rowId)
      if (index < 0) return null
      const row = document.rows[index]
      changeDocument(id, (current) => ({
        ...current,
        rows: current.rows.filter((item) => item.id !== rowId),
      }))
      return { row, index }
    },
    [changeDocument],
  )

  const undoDeleteRow = useCallback(
    (id: string, row: Row, index: number) => {
      changeDocument(id, (document) => {
        const rows = [...document.rows]
        rows.splice(Math.max(0, Math.min(index, rows.length)), 0, row)
        return { ...document, rows }
      })
    },
    [changeDocument],
  )

  const duplicateRow = useCallback(
    (id: string, rowId: string) => {
      changeDocument(id, (document) => {
        const index = document.rows.findIndex((row) => row.id === rowId)
        if (index < 0) return document
        const copy: Row = { id: newId('row'), values: { ...document.rows[index].values } }
        const rows = [...document.rows]
        rows.splice(index + 1, 0, copy)
        return { ...document, rows }
      })
    },
    [changeDocument],
  )

  const setColumns = useCallback(
    (id: string, columns: Column[]) => {
      changeDocument(id, (document) => ({ ...document, columns }))
    },
    [changeDocument],
  )

  const setSettings = useCallback(
    (id: string, settings: Partial<SheetDocument['settings']>) => {
      changeDocument(id, (document) => ({ ...document, settings: { ...document.settings, ...settings } }))
    },
    [changeDocument],
  )

  const deleteDocument = useCallback(
    async (id: string) => {
      const name = fileNamesRef.current[id]
      if (name) {
        try {
          await store.deleteDocument(name)
        } catch {
          // If the file is already gone there is nothing left to remove.
        }
      }
      documentsRef.current = documentsRef.current.filter((document) => document.id !== id)
      setDocuments(documentsRef.current)

      delete fileNamesRef.current[id]
      setFileNames({ ...fileNamesRef.current })
      delete signatures.current[id]

      await localStore.deleteDocument(`${id}.json`)
      if (openDocumentId.current === id) openDocumentId.current = null
    },
    [localStore, store],
  )

  /** Saves one document right now, for example when leaving the screen. */
  const saveOneDocument = useCallback(
    (id: string) => {
      const document = documentsRef.current.find((item) => item.id === id)
      if (!document) return
      if (pendingSave.current) {
        window.clearTimeout(pendingSave.current.timer)
        pendingSave.current = null
      }
      void writeOne(document, fileNamesRef.current[id] ?? null)
    },
    [writeOne],
  )

  // ---------------------------------------------------------------- the lists

  const saveLists = useCallback(
    (next: ListsFile) => {
      const stamped: ListsFile = { ...next, updatedAt: new Date().toISOString() }
      listsRef.current = stamped
      setLists(stamped)
      // Lists are small and are wanted everywhere, so they are written at once.
      void store.writeLists(stamped).catch((error: unknown) => {
        setAlert({
          tone: 'error',
          title: 'The saved lists could not be saved',
          message: friendlyError(error, 'The lists file could not be written.'),
        })
      })
      void writeLocalLists(stamped)
    },
    [store],
  )

  /** Adds a new word to a saved list, ignoring duplicates. */
  const addListValue = useCallback(
    (listName: string, value: string) => {
      const trimmed = value.trim()
      if (trimmed === '') return
      let changed = false
      const next: ListsFile = {
        ...listsRef.current,
        lists: listsRef.current.lists.map((list) => {
          if (list.name !== listName) return list
          if (list.items.some((item) => isSameWord(item.value, trimmed))) return list
          changed = true
          return { ...list, items: [...list.items, { value: trimmed, linked: {} }] }
        }),
      }
      if (changed) saveLists(next)
    },
    [saveLists],
  )

  // ------------------------------------------------------------ older  copies

  const listVersions = useCallback((id: string) => store.listVersions(id), [store])

  const restoreVersion = useCallback(
    async (id: string, stamp: string) => {
      const older = await store.readVersion(stamp)
      if (!older) return
      changeDocument(id, (document) => ({
        ...document,
        title: older.title,
        subtitle: older.subtitle,
        columns: older.columns,
        rows: older.rows,
        settings: older.settings,
      }))
    },
    [changeDocument, store],
  )

  const saveVersionNow = useCallback(
    async (id: string) => {
      const document = documentsRef.current.find((item) => item.id === id)
      if (!document) return
      lastVersionAt.current[id] = Date.now()
      await store.writeVersion(document)
    },
    [store],
  )

  // ------------------------------------------------------- backup and restore

  const backupEverything = useCallback(() => {
    const backup = buildBackupFile(documentsRef.current, listsRef.current)
    downloadTextFile(backupFileName(), JSON.stringify(backup, null, 2))
  }, [])

  const restoreFromBackup = useCallback(async () => {
    const file = await chooseFileToOpen()
    if (!file) return null
    let backup
    try {
      backup = parseBackupFile(await readFileAsText(file))
    } catch {
      setAlert({
        tone: 'error',
        title: 'That file could not be opened',
        message:
          'That does not look like a backup made by this app, so nothing was changed. Choose a file called "data-sheet-backup-....json".',
      })
      return null
    }

    let count = 0
    for (const raw of backup.documents) {
      // Work that is already here is never overwritten by a backup.
      if (documentsRef.current.some((document) => document.id === raw.id)) continue
      const document: SheetDocument = { ...raw, updatedAt: new Date().toISOString() }
      const next = [document, ...documentsRef.current]
      documentsRef.current = next
      setDocuments(next)
      await writeOne(document, null)
      count += 1
    }
    if (count > 0) saveLists(backup.lists)
    return { documents: count }
  }, [saveLists, writeOne])

  // ------------------------------------------------------- reading the folder

  /** Puts a version that came from the folder onto the screen. */
  const adoptChange = useCallback((item: StoredDocument) => {
    signatures.current[item.document.id] = item.signature
    fileNamesRef.current[item.document.id] = item.fileName
    setFileNames({ ...fileNamesRef.current })

    const current = documentsRef.current.filter((document) => document.id !== item.document.id)
    const next = [item.document, ...current]
    documentsRef.current = next
    setDocuments(next)
  }, [])

  /**
   * Looks at the folder and brings anything new, deleted or changed onto the
   * screen. This is the "two-way sync" the user asked for.
   */
  const syncFromStore = useCallback(
    async (quiet: boolean) => {
      if (savingNow.current) return // never fight with a save that is running
      try {
        const contents = await store.readAll()
        setLocationName(contents.locationName)
        setSkippedFiles(contents.skippedFiles)
        if (contents.lists.lists.length > 0 && contents.lists.updatedAt !== listsRef.current.updatedAt) {
          listsRef.current = contents.lists
          setLists(contents.lists)
        }

        const onDisk = new Map(contents.documents.map((item) => [item.document.id, item]))
        const changes: StoredDocument[] = []

        for (const item of contents.documents) {
          const known = documentsRef.current.some((document) => document.id === item.document.id)
          // A different fingerprint means the file was written outside the app.
          if (!known || signatures.current[item.document.id] !== item.signature) {
            changes.push(item)
          }
        }

        // A document we hold whose file is no longer in the folder was deleted.
        const removed = documentsRef.current.filter((document) => !onDisk.has(document.id))

        if (changes.length > 0) {
          const openId = openDocumentId.current
          const openChange = openId ? changes.find((item) => item.document.id === openId) : undefined
          const others = changes.filter((item) => item.document.id !== openId)

          if (openChange) {
            if (pendingSave.current) {
              // The user is typing: ask, rather than losing what is on screen.
              setConflict({
                documentId: openChange.document.id,
                fileName: openChange.fileName,
                signature: openChange.signature,
                document: openChange.document,
              })
            } else {
              adoptChange(openChange)
            }
          }

          if (others.length > 0) {
            let next = [...documentsRef.current]
            for (const change of others) {
              signatures.current[change.document.id] = change.signature
              fileNamesRef.current[change.document.id] = change.fileName
              next = [change.document, ...next.filter((document) => document.id !== change.document.id)]
            }
            documentsRef.current = next
            setDocuments(next)
            setFileNames({ ...fileNamesRef.current })
          }
        }

        if (removed.length > 0) {
          const removedIds = new Set(removed.map((document) => document.id))
          const openId = openDocumentId.current

          if (openId && removedIds.has(openId)) {
            setAlert({
              tone: 'error',
              title: 'This document is not in your folder any more',
              message:
                'The file was deleted or moved outside the app. Nothing on screen was lost. Use "Back up everything" to keep a copy, then close this document.',
            })
          }

          const next = documentsRef.current.filter((document) => !removedIds.has(document.id))
          documentsRef.current = next
          setDocuments(next)
          for (const id of removedIds) {
            delete signatures.current[id]
            delete fileNamesRef.current[id]
          }
          setFileNames({ ...fileNamesRef.current })
        }

        if (!quiet) setConnected(true)
      } catch (error) {
        if (!quiet) {
          setConnected(false)
          setAlert({
            tone: 'error',
            title: 'The folder could not be read',
            message: friendlyError(error, 'The folder could not be opened just now.'),
          })
        }
      }
    },
    [adoptChange, store],
  )

  /** The user answered the "changed outside the app" question. */
  const resolveConflict = useCallback(
    (choice: 'load' | 'keep') => {
      const current = conflict
      setConflict(null)
      if (!current) return
      if (choice === 'load') {
        adoptChange({
          fileName: current.fileName,
          lastModified: 0,
          signature: current.signature,
          document: current.document,
        })
      } else {
        // Keep what is on screen by saving it over the file.
        queueSave(current.documentId)
      }
    },
    [adoptChange, conflict, queueSave],
  )

  // -------------------------------------------------------- choosing a folder

  const connectFolder = useCallback(async () => {
    try {
      if (!folderStore.isConnected()) {
        await folderStore.chooseFolder()
      } else if (!(await folderStore.connect())) {
        setAlert({
          tone: 'error',
          title: 'Access to the folder was not given',
          message: 'Nothing was changed. Click "Reconnect to your saved documents" and choose the same folder again.',
        })
        return
      }
      setMode('folder')
      setConnected(true)
      setAlert(null)
      await syncFromStore(true)

      // Anything that could not be written to the folder earlier is written now.
      const pending = await localStore.readPending()
      if (pending) {
        const document = await localStore.readDocument(pending)
        if (document) {
          await writeOne(document, null)
          await localStore.markPending(pending, false)
        }
      }
    } catch (error) {
      // Closing the folder window is not a problem, so it is not an error.
      if (error instanceof Error && error.name === 'AbortError') return
      setAlert({
        tone: 'error',
        title: 'The folder was not connected',
        message: friendlyError(error, 'The folder could not be used.'),
      })
    }
  }, [folderStore, localStore, syncFromStore, writeOne])

  const disconnectFolder = useCallback(async () => {
    await folderStore.disconnect()
    setConnected(false)
    setLocationName('')
  }, [folderStore])

  const refreshFromFolder = useCallback(() => syncFromStore(false), [syncFromStore])

  // ------------------------------------------------------------------ startup

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      // 1. Does this browser remember a folder from a previous visit?
      if (foldersSupported) {
        await folderStore.restoreRememberedFolder()
        if (cancelled) return

        if (folderStore.isConnected()) {
          try {
            const allowed = await folderStore.connect()
            if (allowed) {
              setMode('folder')
              setConnected(true)
              await syncFromStore(true)
              if (cancelled) return
            } else {
              // Browsers ask for the folder again after being closed. The home
              // screen then shows one clear button to reconnect.
              setMode('folder')
              setConnected(false)
              setLoading(false)
              return
            }
          } catch {
            setMode('folder')
            setConnected(false)
          }
        } else {
          setMode('folder')
          setConnected(false)
        }
      } else {
        // This browser cannot open folders, so the work stays in the browser.
        setMode('browser')
        setConnected(true)
        await syncFromStore(true)
        if (cancelled) return
      }
      setLoading(false)
    }

    void start()
    return () => {
      cancelled = true
    }
    // This runs once, when the app opens.
  }, [foldersSupported, folderStore, syncFromStore])

  // Look at the folder every 10 seconds, and again whenever the tab is used.
  useEffect(() => {
    if (mode !== 'folder' || !connected) return
    const timer = window.setInterval(() => void syncFromStore(true), SYNC_INTERVAL_MS)
    const onWake = () => void syncFromStore(true)
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [connected, mode, syncFromStore])

  // Warn before closing the tab while something has not been saved yet.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingSave.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // If the tab is closed with a change still waiting, keep it in the browser's
  // storage straight away. The file itself is written by the one-second timer,
  // which normally finishes long before the tab closes.
  useEffect(() => {
    return () => {
      const waiting = pendingSave.current
      if (!waiting) return
      window.clearTimeout(waiting.timer)
      const document = documentsRef.current.find((item) => item.id === waiting.id)
      if (document) void writeLocalDocument(document.id, document)
    }
  }, [])

  return {
    documents,
    fileNames,
    lists,
    mode,
    connected,
    foldersSupported,
    locationName,
    loading,
    saveState,
    lastSavedAt,
    unsaved,
    alert,
    skippedFiles,
    conflict,
    setOpenDocument,
    connectFolder,
    disconnectFolder,
    refreshFromFolder,
    createDocument,
    updateDocument,
    addRow,
    updateRow,
    deleteRow,
    undoDeleteRow,
    duplicateRow,
    setColumns,
    setSettings,
    deleteDocument,
    saveOneDocument,
    saveLists,
    addListValue,
    listVersions,
    restoreVersion,
    saveVersionNow,
    backupEverything,
    restoreFromBackup,
    setAlert,
    resolveConflict,
  }
}

/** Reads one document from the browser's spare copy, used when recovering work. */
export async function readSpareDocument(id: string): Promise<SheetDocument | null> {
  const stored = await readLocalDocument<unknown>(id)
  if (typeof stored !== 'object' || stored === null) return null
  return stored as SheetDocument
}
