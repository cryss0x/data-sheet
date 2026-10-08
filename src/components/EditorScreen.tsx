/**
 * components/EditorScreen.tsx
 * ---------------------------
 * The screen where the work happens: the title, the boxes for adding a row, the
 * table, the totals, and the buttons for saving, designing columns, printing and
 * making a PDF.
 *
 * Everything on this screen works on the document that is passed in, and every
 * change is handed to the app's store, which saves it straight away.
 */

import { useMemo, useState } from 'react'
import { PRIVACY_NOTE } from '../constants'
import type { ListsFile, Row, SheetDocument, SheetSettings } from '../types'
import { formatNumber, plural } from '../utils/format'
import { applyLinks } from '../utils/links'
import { calculateGroups, calculateTotals, filterRows, sortRows } from '../utils/totals'
import type { RowFilter } from '../utils/totals'
import { ColumnDesigner } from './ColumnDesigner'
import { DataTable } from './DataTable'
import { EntryForm } from './EntryForm'
import { PrintSheet } from './PrintSheet'
import { SaveStatus } from './SaveStatus'
import { VersionsDialog } from './VersionsDialog'
import { Badge, Button, Card, ConfirmDialog, NoteBox, TextField, Toggle } from './ui'

export function EditorScreen({
  document,
  lists,
  saveState,
  lastSavedAt,
  mode,
  connected,
  onBack,
  onChangeTitle,
  onChangeSubtitle,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onUndoDeleteRow,
  onDuplicateRow,
  onSetColumns,
  onSetSettings,
  onCreateListValue,
  onDeleteDocument,
  onListVersions,
  onRestoreVersion,
  onSaveVersionNow,
  conflict,
  onResolveConflict,
}: {
  document: SheetDocument
  lists: ListsFile
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: string | null
  mode: 'folder' | 'browser'
  connected: boolean
  onBack: () => void
  onChangeTitle: (title: string) => void
  onChangeSubtitle: (subtitle: string) => void
  onAddRow: (row: Row) => void
  onUpdateRow: (rowId: string, values: Row['values']) => void
  onDeleteRow: (rowId: string) => { row: Row; index: number } | null
  onUndoDeleteRow: (row: Row, index: number) => void
  onDuplicateRow: (rowId: string) => void
  onSetColumns: (columns: SheetDocument['columns']) => void
  onSetSettings: (settings: Partial<SheetSettings>) => void
  onCreateListValue: (listName: string, value: string) => void
  onDeleteDocument: () => Promise<void>
  onListVersions: () => Promise<import('../types').DocumentVersion[]>
  onRestoreVersion: (stamp: string) => Promise<void>
  onSaveVersionNow: () => Promise<void>
  conflict: { documentId: string; document: SheetDocument } | null
  onResolveConflict: (choice: 'load' | 'keep') => void
}) {
  const { columns, rows, settings } = document

  const [showDesigner, setShowDesigner] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [askingDeleteRow, setAskingDeleteRow] = useState<Row | null>(null)
  const [askingDeleteDocument, setAskingDeleteDocument] = useState(false)
  const [lastDeleted, setLastDeleted] = useState<{ row: Row; index: number } | null>(null)
  const [filters, setFilters] = useState<RowFilter[]>([])
  const [showNote, setShowNote] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // The rows the user can look at: filtered and sorted, but the saved order is
  // never changed by looking at them.
  const visibleRows = useMemo(
    () => sortRows(filterRows(rows, filters), settings.sortMode, columns),
    [columns, filters, rows, settings.sortMode],
  )

  // Which cells can be merged when "Group rows" is switched on.
  const groups = useMemo(
    () => (settings.groupRows ? calculateGroups(columns, visibleRows) : visibleRows.map(() => ({}))),
    [columns, settings.groupRows, visibleRows],
  )

  const totals = useMemo(() => calculateTotals(columns, visibleRows), [columns, visibleRows])

  // Only the columns that make sense to filter by (drop-down columns).
  const filterableColumns = columns.filter((column) => column.type === 'pick' || column.type === 'multi')

  const filterFor = (columnId: string) => filters.find((filter) => filter.columnId === columnId)?.value ?? ''

  const setFilter = (columnId: string, value: string) => {
    setFilters((current) => {
      const rest = current.filter((filter) => filter.columnId !== columnId)
      return value === '' ? rest : [...rest, { columnId, value }]
    })
  }

  /** One cell was changed. Linked columns are filled in at the same time. */
  const handleCellChange = (row: Row, columnId: string, value: Row['values'][string]) => {
    const values = { ...row.values, [columnId]: value }
    const linked = applyLinks({ columns, lists, changedColumnId: columnId, values })
    onUpdateRow(row.id, linked)
  }

  const filtered = filters.some((filter) => filter.value !== '') || settings.sortMode !== 'none'

  const exportPdf = async () => {
    if (visibleRows.length === 0) {
      setMessage('There is nothing to export yet. Add at least one row first.')
      return
    }
    // The PDF library is only loaded when it is needed, which keeps the app
    // quick to open.
    setMessage('Making your PDF…')
    const { exportDocumentToPdf } = await import('../pdf/exportPdf')
    exportDocumentToPdf({ document, rows: visibleRows, groups, totals })
    setMessage(null)
  }

  const print = () => {
    if (visibleRows.length === 0) {
      setMessage('There is nothing to print yet. Add at least one row first.')
      return
    }
    setPrinting(true)
    // The browser needs one moment to lay the printed page out before printing.
    window.setTimeout(() => {
      window.print()
      window.setTimeout(() => setPrinting(false), 500)
    }, 50)
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5">
      <div className="screen-only">
        {/* The line across the top: back, title, and the saving mark. */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Button onClick={onBack}>← My documents</Button>
              {showNote || document.subtitle.trim() !== '' ? (
                <button
                  type="button"
                  onClick={() => setShowNote((current) => !current)}
                  className="text-sm font-semibold text-brand-800 underline"
                >
                  {showNote ? 'Hide the note' : '+ Add a note'}
                </button>
              ) : null}
            </div>

            <input
              value={document.title}
              aria-label="Document title"
              onChange={(event) => onChangeTitle(event.target.value)}
              className="mt-2 w-full border-b-2 border-transparent bg-transparent text-2xl font-black text-ink-900 outline-none focus:border-brand-600 sm:text-3xl"
            />

            {showNote || document.subtitle.trim() !== '' ? (
              <div className="mt-1 max-w-2xl">
                <TextField
                  value={document.subtitle}
                  onChange={onChangeSubtitle}
                  placeholder="A note under the title, for example: KALPTEJ INVESTMENT LTD."
                />
              </div>
            ) : null}

            <div className="mt-2">
              <SaveStatus state={saveState} lastSavedAt={lastSavedAt} mode={mode} connected={connected} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button kind="primary" big onClick={() => void exportPdf()}>
              ⬇ Export PDF
            </Button>
            <Button onClick={print}>🖨 Print</Button>
          </div>
        </div>

        {message ? (
          <div className="mb-4">
            <NoteBox>{message}</NoteBox>
          </div>
        ) : null}

        {askingDeleteRow ? (
          <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-bold text-amber-900">Delete this row?</p>
            <p className="mt-0.5 text-sm text-amber-900">
              It will be removed from the table. You can put it back straight afterwards with “Undo”.
            </p>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => setAskingDeleteRow(null)}>No, keep it</Button>
              <Button
                kind="danger"
                onClick={() => {
                  const removed = onDeleteRow(askingDeleteRow.id)
                  setAskingDeleteRow(null)
                  setLastDeleted(removed)
                }}
              >
                Yes, delete the row
              </Button>
            </div>
          </div>
        ) : null}

        {/* The entry form. */}
        <div className="mb-4">
          <EntryForm
            columns={columns}
            lists={lists}
            keepDate={settings.keepDate}
            repeatLast={settings.repeatLast}
            busy={false}
            onKeepDateChange={(value) => onSetSettings({ keepDate: value })}
            onRepeatLastChange={(value) => onSetSettings({ repeatLast: value })}
            onCreateListValue={onCreateListValue}
            onAddRow={onAddRow}
          />
        </div>

        {/* The toolbar for the table itself. */}
        <Card className="mb-3 p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowDesigner(true)}>Design columns</Button>
              <Button onClick={() => setShowVersions(true)}>Restore an earlier version</Button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Toggle
                checked={settings.groupRows}
                onChange={(value) => onSetSettings({ groupRows: value })}
                label="Group rows"
                hint="Show repeated values once, merged down"
              />
              <Toggle
                checked={settings.showRowCount}
                onChange={(value) => onSetSettings({ showRowCount: value })}
                label="Show a row count"
                hint="Adds a line with the number of rows"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-700">
              <span className="font-semibold">Show rows in date order:</span>
              <select
                value={settings.sortMode}
                onChange={(event) => onSetSettings({ sortMode: event.target.value as SheetSettings['sortMode'] })}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="none">As I entered them</option>
                <option value="date-asc">Oldest date first</option>
                <option value="date-desc">Newest date first</option>
              </select>
            </label>
          </div>

          {filterableColumns.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
              <span className="text-sm font-bold text-ink-700">Find rows:</span>
              {filterableColumns.map((column) => {
                const list = lists.lists.find((item) => item.name === column.listName)
                const options = (list?.items ?? []).map((item) => item.value)
                return (
                  <label key={column.id} className="block">
                    <span className="mb-1 block text-xs font-bold text-ink-500 uppercase">{column.name}</span>
                    <select
                      value={filterFor(column.id)}
                      onChange={(event) => setFilter(column.id, event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">All</option>
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              })}
              {filtered ? (
                <Button
                  onClick={() => {
                    setFilters([])
                    onSetSettings({ sortMode: 'none' })
                  }}
                >
                  Show all rows
                </Button>
              ) : null}
              {filtered ? (
                <Badge>
                  Showing {formatNumber(visibleRows.length)} of {formatNumber(rows.length)} rows
                </Badge>
              ) : null}
            </div>
          ) : null}
        </Card>

        {/* The table. */}
        <DataTable
          columns={columns}
          rows={visibleRows}
          groups={groups}
          totals={totals}
          settings={settings}
          lists={lists}
          onChangeCell={(rowId, columnId, value) => {
            const row = rows.find((item) => item.id === rowId)
            if (!row) return
            handleCellChange(row, columnId, value)
          }}
          onCreateListValue={onCreateListValue}
          onDuplicateRow={onDuplicateRow}
          onDeleteRow={(rowId) => {
            const row = rows.find((item) => item.id === rowId)
            if (row) setAskingDeleteRow(row)
          }}
          onEditRow={() => undefined}
          onUndoDelete={() => {
            if (!lastDeleted) return
            onUndoDeleteRow(lastDeleted.row, lastDeleted.index)
            setLastDeleted(null)
          }}
          lastDeleted={lastDeleted}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-500">
            {plural(rows.length, 'row')} saved · grand total {formatNumber(totals.grandTotal)} · {PRIVACY_NOTE}
          </p>
          <Button kind="danger" onClick={() => setAskingDeleteDocument(true)}>
            Delete this document
          </Button>
        </div>
      </div>

      {/* The layout that is sent to the printer. */}
      {printing ? (
        <PrintSheet
          title={document.title}
          subtitle={document.subtitle}
          columns={columns}
          rows={visibleRows}
          groups={groups}
          totals={totals}
          settings={settings}
        />
      ) : null}

      {showDesigner ? (
        <ColumnDesigner
          columns={columns}
          rows={rows}
          lists={lists.lists}
          onSave={onSetColumns}
          onClose={() => setShowDesigner(false)}
        />
      ) : null}

      {showVersions ? (
        <VersionsDialog
          documentTitle={document.title}
          listVersions={onListVersions}
          onRestore={onRestoreVersion}
          onKeepThisVersion={onSaveVersionNow}
          onClose={() => setShowVersions(false)}
        />
      ) : null}

      {askingDeleteDocument ? (
        <ConfirmDialog
          title="Delete this document?"
          message={`“${document.title}” and all ${plural(rows.length, 'row')} in it will be deleted, and the file in your folder will be removed too. This cannot be undone.`}
          confirmWord="Delete it"
          onCancel={() => setAskingDeleteDocument(false)}
          onConfirm={async () => {
            setAskingDeleteDocument(false)
            await onDeleteDocument()
          }}
        />
      ) : null}

      {conflict ? (
        <ConfirmDialog
          title="This document was changed outside the app"
          message="Another copy of this file was changed in your folder while you were working. Would you like to load the new version, or keep the version that is on your screen?"
          confirmWord="Load the new version"
          onCancel={() => onResolveConflict('keep')}
          onConfirm={() => onResolveConflict('load')}
        />
      ) : null}
    </div>
  )
}
