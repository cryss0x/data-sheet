/**
 * components/HomeScreen.tsx
 * -------------------------
 * The first screen: every saved document, with its last change and how many rows
 * it has. From here the user opens, creates, searches or deletes a document, and
 * can back up everything with one button.
 */

import { useMemo, useState } from 'react'
import { APP_NAME, PRIVACY_NOTE } from '../constants'
import type { SheetDocument } from '../types'
import { formatDateTime, plural } from '../utils/format'
import { Badge, Button, Card, ConfirmDialog, NoteBox, TextField } from './ui'

export function HomeScreen({
  documents,
  locationName,
  foldersSupported,
  onOpen,
  onCreate,
  onImport,
  onDelete,
  onManageLists,
  onBackup,
  onRestore,
  onConnectFolder,
  onChooseFolder,
  savingHint,
}: {
  documents: SheetDocument[]
  locationName: string
  foldersSupported: boolean
  onOpen: (id: string) => void
  onCreate: () => void
  onImport: () => void
  onDelete: (id: string) => void
  onManageLists: () => void
  onBackup: () => void
  onRestore: () => Promise<{ documents: number } | null>
  onConnectFolder: () => void
  onChooseFolder: () => void
  savingHint: string
}) {
  const [search, setSearch] = useState('')
  const [askingDelete, setAskingDelete] = useState<SheetDocument | null>(null)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)

  // Newest change first, and the search box filters by title.
  const shown = useMemo(() => {
    const words = search.trim().toLowerCase()
    return [...documents]
      .filter((document) => (words === '' ? true : document.title.toLowerCase().includes(words)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [documents, search])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-3xl font-black text-ink-900">{APP_NAME}</h1>
        <p className="mt-1 text-ink-500">
          Make a table of anything you like, save it to your own folder, and print it as a clean PDF.
        </p>
      </header>

      {/* Where the work is kept. */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-ink-900">
              {foldersSupported ? 'Saving in your folder' : 'Saving in this browser'}
            </p>
            <p className="mt-0.5 text-sm text-ink-500">
              {locationName ? `Folder: ${locationName}` : savingHint}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {foldersSupported ? (
              <>
                <Button onClick={onConnectFolder}>Reconnect to your saved documents</Button>
                <Button onClick={onChooseFolder}>Choose a different folder</Button>
              </>
            ) : null}
            <Button onClick={onManageLists}>Manage lists</Button>
          </div>
        </div>
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-ink-500">
          🔒 {PRIVACY_NOTE} Nothing is ever sent to the internet.
        </p>
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-3 sm:flex-1 sm:flex-row">
          <Button kind="primary" big full onClick={onCreate}>
            + New document
          </Button>
          <Button big full onClick={onImport}>
            Import PDF
          </Button>
        </div>
        <div className="sm:w-72">
          <TextField
            value={search}
            onChange={setSearch}
            placeholder="Search by title..."
            ariaLabel="Search for a document by its title"
          />
        </div>
      </div>

      {restoreMessage ? <NoteBox>{restoreMessage}</NoteBox> : null}

      {shown.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-lg font-bold text-ink-700">
            {documents.length === 0 ? 'No documents yet.' : 'Nothing matches that search.'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            {documents.length === 0
              ? 'Click “New document” to make your first one. You choose the title and the columns, then you just type your rows.'
              : 'Try a different word, or clear the search box to see all of them.'}
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((document) => (
            <li key={document.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-ink-900">{document.title}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    Last change: {formatDateTime(document.updatedAt)} · {plural(document.rows.length, 'row')} ·{' '}
                    {plural(document.columns.length, 'column')}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button kind="primary" onClick={() => onOpen(document.id)}>
                    Open
                  </Button>
                  <Button kind="danger" onClick={() => setAskingDelete(document)}>
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Backing up and restoring. */}
      <Card className="mt-6 p-4">
        <p className="text-sm font-bold text-ink-900">Keep a copy</p>
        <p className="mt-1 text-sm text-ink-500">
          “Back up everything” saves all your documents and lists into one single file. Keep that file
          somewhere safe, for example on a memory stick.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={onBackup}>Back up everything</Button>
          <Button
            onClick={async () => {
              const result = await onRestore()
              if (result) {
                setRestoreMessage(
                  result.documents === 0
                    ? 'That backup was opened. Everything in it is already here, so nothing was added.'
                    : `${result.documents} document(s) were added from the backup file.`,
                )
              }
            }}
          >
            Restore from backup
          </Button>
        </div>
      </Card>

      {askingDelete ? (
        <ConfirmDialog
          title="Delete this document?"
          message={`“${askingDelete.title}” will be deleted, and its file in your folder will be removed too. If you only want to hide it, close this window instead.`}
          confirmWord="Delete it"
          onCancel={() => setAskingDelete(null)}
          onConfirm={async () => {
            const target = askingDelete
            setAskingDelete(null)
            await onDelete(target.id)
          }}
        />
      ) : null}
    </div>
  )
}

/** The small mark showing where the work is being kept. */
export function StorageBadge({ mode, connected }: { mode: 'folder' | 'browser'; connected: boolean }) {
  if (mode === 'browser') return <Badge>Saved in this browser</Badge>
  return <Badge tone={connected ? 'green' : 'red'}>{connected ? 'Saved in your folder' : 'Folder not connected'}</Badge>
}
