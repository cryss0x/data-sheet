/**
 * components/VersionsDialog.tsx
 * -----------------------------
 * "Restore an earlier version".
 *
 * The app quietly keeps the last few copies of every document in a small folder
 * inside your own folder (called "_history"). This window simply lists them, so
 * a mistake can be put right without any technical knowledge.
 */

import { useEffect, useState } from 'react'
import type { DocumentVersion } from '../types'
import { formatDateTime } from '../utils/format'
import { Button, Modal } from './ui'

export function VersionsDialog({
  documentTitle,
  listVersions,
  onRestore,
  onKeepThisVersion,
  onClose,
}: {
  documentTitle: string
  listVersions: () => Promise<DocumentVersion[]>
  onRestore: (stamp: string) => Promise<void>
  onKeepThisVersion: () => Promise<void>
  onClose: () => void
}) {
  const [versions, setVersions] = useState<DocumentVersion[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listVersions().then((found) => {
      if (!cancelled) setVersions(found)
    })
    return () => {
      cancelled = true
    }
  }, [listVersions])

  return (
    <Modal title="Restore an earlier version" onClose={onClose}>
      <p className="mb-4 text-sm text-ink-500">
        The app keeps the last few copies of “{documentTitle}” for you. Choose one to bring it back.
      </p>

      {message ? <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}

      {versions === null ? (
        <p className="py-6 text-center text-ink-500">Looking for your saved copies…</p>
      ) : versions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-ink-500">
          No earlier copies have been made yet. They are kept as you work, so come back in a few minutes and
          this list will be filled.
        </p>
      ) : (
        <ul className="space-y-2">
          {versions.map((version) => (
            <li
              key={version.stamp}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div>
                <p className="font-semibold text-ink-900">{formatDateTime(version.savedAt)}</p>
                <p className="text-xs text-ink-500">
                  {version.rowCount} row{version.rowCount === 1 ? '' : 's'}
                  {version.title ? ` · “${version.title}”` : ''}
                </p>
              </div>
              <Button
                kind="primary"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(version.stamp)
                  await onRestore(version.stamp)
                  setBusy(null)
                  setMessage('That copy is back. It has been saved as your document now.')
                }}
              >
                {busy === version.stamp ? 'Restoring…' : 'Bring this one back'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs text-ink-500">
          Want to be able to come back to what is on screen right now? Keep a copy of it first.
        </p>
        <Button
          onClick={async () => {
            await onKeepThisVersion()
            setVersions(await listVersions())
            setMessage('A copy of the version on screen has been kept.')
          }}
        >
          Keep a copy of the version on screen
        </Button>
      </div>
    </Modal>
  )
}
