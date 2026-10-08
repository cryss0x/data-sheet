/**
 * components/ImportDocumentDialog.tsx
 * -----------------------------------
 * Reading a PDF that is already saved on this computer, showing what was
 * found in it, and then making a real document out of it.
 *
 * The window has three moments: while the file is being read, when something
 * went wrong, and when the table is ready to be looked at before importing.
 */

import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../constants'
import { NoTableError } from '../pdf/importTable'
import { readPdfTable } from '../pdf/importPdf'
import type { PdfImportResult } from '../pdf/importPdf'
import { friendlyError } from '../storage/types'
import type { Column, Row, SheetDocument } from '../types'
import { plural, titleFromFileName } from '../utils/format'
import { newId } from '../utils/id'
import { Button, Modal, TextField } from './ui'

/** How many rows of the table are shown before importing. */
const PREVIEW_ROWS = 6

export function ImportDocumentDialog({
  file,
  onImport,
  onClose,
}: {
  file: File
  onImport: (document: SheetDocument) => Promise<SheetDocument>
  onClose: () => void
}) {
  const [status, setStatus] = useState<'reading' | 'ready' | 'error'>('reading')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<PdfImportResult | null>(null)
  const [title, setTitle] = useState('')
  const [importing, setImporting] = useState(false)

  // The file is read once, as soon as the window opens.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const found = await readPdfTable(file)
        if (cancelled) return
        setResult(found)
        setTitle(found.pdfTitle !== '' ? found.pdfTitle.slice(0, 120) : titleFromFileName(file.name))
        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        setMessage(
          error instanceof NoTableError
            ? error.message
            : friendlyError(error, 'That file could not be read as a PDF file.'),
        )
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file])

  const trimmed = title.trim()
  const preview = result ? result.table.rows.slice(0, PREVIEW_ROWS) : []

  const importIt = async () => {
    if (!result || trimmed === '') return
    setImporting(true)
    try {
      const now = new Date().toISOString()
      const columns: Column[] = result.table.columns.map((column) => ({
        id: newId('col'),
        name: column.name,
        type: column.type,
      }))
      const rows: Row[] = result.table.rows.map((cells) => {
        const values: Row['values'] = {}
        columns.forEach((column, index) => {
          values[column.id] = cells[index] ?? ''
        })
        return { id: newId('row'), values }
      })
      await onImport({
        id: newId('doc'),
        title: trimmed,
        subtitle: '',
        createdAt: now,
        updatedAt: now,
        columns,
        rows,
        settings: { ...DEFAULT_SETTINGS },
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal title="Import document" onClose={onClose} wide>
      {status === 'reading' ? (
        <div className="py-6 text-center">
          <p className="text-lg font-bold text-ink-900">Reading “{file.name}”…</p>
          <p className="mt-2 text-sm text-ink-500">
            Looking for the table inside the file. Nothing is sent anywhere.
          </p>
          <div className="mt-6 flex justify-end">
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {status === 'error' ? (
        <div>
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{message}</p>
          <div className="mt-6 flex justify-end">
            <Button kind="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      {status === 'ready' && result ? (
        <div>
          <p className="mb-1 block text-sm font-bold">What is this document called?</p>
          <TextField value={title} onChange={setTitle} ariaLabel="Document title" autoFocus />
          <p className="mt-2 text-sm text-ink-500">
            {plural(result.table.columns.length, 'column')} and {plural(result.table.rows.length, 'row')} were
            found in {plural(result.pageCount, 'page')} of the file. This name is also used for the file in
            your folder.
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  {result.table.columns.map((column) => (
                    <th
                      key={column.name}
                      className="px-3 py-2 text-left text-xs font-bold whitespace-nowrap text-ink-700"
                    >
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((cells, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-slate-100">
                    {result.table.columns.map((column, columnIndex) => (
                      <td
                        key={column.name}
                        className="max-w-64 truncate px-3 py-1.5 text-ink-900"
                        title={cells[columnIndex] ?? ''}
                      >
                        {cells[columnIndex] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Showing the first {plural(preview.length, 'row')}. Everything can be changed after importing.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Cancel</Button>
            <Button kind="primary" big disabled={trimmed === '' || importing} onClick={() => void importIt()}>
              {importing ? 'Importing…' : 'Import document'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
