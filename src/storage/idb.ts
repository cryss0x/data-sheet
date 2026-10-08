/**
 * storage/idb.ts
 * --------------
 * A very small helper for the browser's own storage (IndexedDB).
 *
 * IndexedDB is built into the browser and lives only on this computer. We use it
 * for three small jobs:
 *   1. remembering which folder the user chose,
 *   2. a quick copy of the latest work, so a crash cannot lose anything,
 *   3. the fallback when the browser cannot open folders (Firefox, Safari, phone).
 *
 * This is plain TypeScript - no extra library is needed.
 */

const DB_NAME = 'data-sheet'
const DB_VERSION = 1

/** The names of the small "shelves" inside the database. */
export const STORES = {
  settings: 'settings', // small things, like the chosen folder
  documents: 'documents', // a copy of every document
  lists: 'lists', // a copy of the saved lists
} as const

let dbPromise: Promise<IDBDatabase> | null = null

/** Opens the database, creating it the first time. */
function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings)
      if (!db.objectStoreNames.contains(STORES.documents)) db.createObjectStore(STORES.documents)
      if (!db.objectStoreNames.contains(STORES.lists)) db.createObjectStore(STORES.lists)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the browser storage.'))
  })

  return dbPromise
}

/** Runs one action on one shelf. */
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = action(transaction.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The browser storage did not answer.'))
  })
}

/** True when this browser has IndexedDB (almost always true). */
export function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

/** Reads one small setting, for example the remembered folder. */
export async function readSetting<T>(key: string): Promise<T | undefined> {
  try {
    return await withStore<T>(STORES.settings, 'readonly', (store) => store.get(key) as IDBRequest<T>)
  } catch {
    return undefined
  }
}

/** Saves one small setting. */
export async function writeSetting(key: string, value: unknown): Promise<void> {
  await withStore(STORES.settings, 'readwrite', (store) => store.put(value, key) as IDBRequest<IDBValidKey>)
}

/** Forgets one small setting. */
export async function removeSetting(key: string): Promise<void> {
  await withStore(STORES.settings, 'readwrite', (store) => store.delete(key) as unknown as IDBRequest<undefined>)
}

/** Reads one document from the browser's copy. */
export async function readLocalDocument<T>(id: string): Promise<T | undefined> {
  try {
    return await withStore<T>(STORES.documents, 'readonly', (store) => store.get(id) as IDBRequest<T>)
  } catch {
    return undefined
  }
}

/** Saves one document into the browser's copy. */
export async function writeLocalDocument(id: string, value: unknown): Promise<void> {
  await withStore(STORES.documents, 'readwrite', (store) => store.put(value, id) as IDBRequest<IDBValidKey>)
}

/** Reads every document from the browser's copy. */
export async function readAllLocalDocuments<T>(): Promise<T[]> {
  try {
    return (await withStore<T[]>(STORES.documents, 'readonly', (store) => store.getAll() as IDBRequest<T[]>)) ?? []
  } catch {
    return []
  }
}

/** Removes one document from the browser's copy. */
export async function deleteLocalDocument(id: string): Promise<void> {
  try {
    await withStore(STORES.documents, 'readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>)
  } catch {
    // Nothing to do: the browser's copy is only a spare copy.
  }
}

/** Reads the browser's copy of the saved lists. */
export async function readLocalLists<T>(): Promise<T | undefined> {
  try {
    return await withStore<T>(STORES.lists, 'readonly', (store) => store.get('lists') as IDBRequest<T>)
  } catch {
    return undefined
  }
}

/** Saves the browser's copy of the saved lists. */
export async function writeLocalLists(value: unknown): Promise<void> {
  try {
    await withStore(STORES.lists, 'readwrite', (store) => store.put(value, 'lists') as IDBRequest<IDBValidKey>)
  } catch {
    // Nothing to do: the browser's copy is only a spare copy.
  }
}
