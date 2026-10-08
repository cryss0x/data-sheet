/**
 * components/EntryForm.tsx
 * -----------------------
 * The row of boxes above the table, used to add a new line of detail.
 *
 * There is one box per column, and one big "Add row" button. Pressing Enter adds
 * the row as well, so a person can type their way through a list without ever
 * touching the mouse.
 *
 * Two small settings make the job much faster for real records:
 *   - "Keep the same date for the next row" (many rows share one day), and
 *   - "Repeat the previous row's words" (the same driver and truck for many
 *     lines).
 */

import { useEffect, useRef, useState } from 'react'
import type { CellValue, Column, ListsFile, Row } from '../types'
import { newId } from '../utils/id'
import { CellEditor } from './CellInputs'
import { Button, Checkbox } from './ui'

/** An empty set of values, one for each column. */
export function emptyValues(columns: Column[]): Record<string, CellValue> {
  const values: Record<string, CellValue> = {}
  for (const column of columns) values[column.id] = column.type === 'multi' ? [] : ''
  return values
}

export function EntryForm({
  columns,
  lists,
  keepDate,
  repeatLast,
  onKeepDateChange,
  onRepeatLastChange,
  onAddRow,
  onCreateListValue,
  busy,
}: {
  columns: Column[]
  lists: ListsFile
  keepDate: boolean
  repeatLast: boolean
  onKeepDateChange: (value: boolean) => void
  onRepeatLastChange: (value: boolean) => void
  onAddRow: (row: Row) => void
  onCreateListValue: (listName: string, value: string) => void
  busy: boolean
}) {
  const [values, setValues] = useState<Record<string, CellValue>>(() => emptyValues(columns))
  const formRef = useRef<HTMLFormElement>(null)

  // When columns are added, renamed or removed, the boxes follow them.
  useEffect(() => {
    setValues((current) => {
      const next = emptyValues(columns)
      for (const column of columns) {
        if (column.id in current) next[column.id] = current[column.id]
      }
      return next
    })
  }, [columns])

  const setValue = (columnId: string, value: CellValue) => {
    setValues((current) => ({ ...current, [columnId]: value }))
  }

  const dateColumn = columns.find((column) => column.type === 'date')
  const numberColumn = columns.find(
    (column) => column.type === 'amount' || column.type === 'quantity',
  )

  const addRow = () => {
    if (columns.length === 0) return
    onAddRow({ id: newId('row'), values })
    // The form clears, so the next line starts fresh. The date and the repeated
    // words stay if the user asked for that.
    setValues((current) => {
      const next = emptyValues(columns)
      if (keepDate && dateColumn) next[dateColumn.id] = current[dateColumn.id]
      if (repeatLast) {
        for (const column of columns) {
          if (column.type === 'amount' || column.type === 'quantity') continue
          if (dateColumn && column.id === dateColumn.id) continue
          if (column.id in current) next[column.id] = current[column.id]
        }
      }
      return next
    })
    // Put the cursor back in the first box, ready for the next line.
    window.setTimeout(() => {
      const first = formRef.current?.querySelector<HTMLInputElement>('input, select')
      first?.focus()
    }, 0)
  }

  if (columns.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="font-semibold text-ink-700">This document has no columns yet.</p>
        <p className="mt-1 text-sm text-ink-500">
          Use the “Design columns” button above to add the columns you want.
        </p>
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault()
        addRow()
      }}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {columns.map((column) => (
          <div key={column.id} className={column.type === 'multi' ? 'sm:col-span-2' : ''}>
            <label className="mb-1 block text-xs font-bold tracking-wide text-ink-500 uppercase">
              {column.name}
            </label>
            <CellEditor
              column={column}
              value={values[column.id]}
              lists={lists.lists}
              onChange={(value) => setValue(column.id, value)}
              onCreateListValue={onCreateListValue}
              ariaLabel={column.name}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button type="submit" kind="primary" big disabled={busy}>
          + Add row
        </Button>
        <Checkbox checked={keepDate} onChange={onKeepDateChange} label="Keep the same date for the next row" />
        <Checkbox
          checked={repeatLast}
          onChange={onRepeatLastChange}
          label="Repeat the previous row's words"
        />
        {numberColumn ? (
          <span className="text-xs text-ink-500">
            Tip: leave any box empty if you do not have that detail. Press Enter to add the row.
          </span>
        ) : null}
      </div>
    </form>
  )
}
