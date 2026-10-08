/**
 * components/DataTable.tsx
 * -----------------------
 * The table that shows everything that has been entered.
 *
 * - A heading row, and shading that alternates so the lines are easy to follow.
 * - Every box can be edited by clicking straight into it.
 * - With "Group rows" switched on, a value that repeats on the rows below is
 *   shown once and stretched down, so a driver with three lines shows the driver
 *   name only once.
 * - Two totals lines at the bottom: one for each column, and the grand total of
 *   all the money.
 */

import { useRef } from 'react'
import type { CellValue, Column, ListsFile, Row, SheetSettings } from '../types'
import { formatNumber } from '../utils/format'
import type { GroupInfo, TotalsResult } from '../utils/totals'
import { totalsCellText } from '../utils/totals'
import { CellEditor } from './CellInputs'

export function DataTable({
  columns,
  rows,
  groups,
  totals,
  settings,
  lists,
  onChangeCell,
  onCreateListValue,
  onDuplicateRow,
  onDeleteRow,
  onEditRow,
  onUndoDelete,
  lastDeleted,
}: {
  columns: Column[]
  rows: Row[]
  groups: GroupInfo[]
  totals: TotalsResult
  settings: SheetSettings
  lists: ListsFile
  onChangeCell: (rowId: string, columnId: string, value: CellValue) => void
  onCreateListValue: (listName: string, value: string) => void
  onDuplicateRow: (rowId: string) => void
  onDeleteRow: (rowId: string) => void
  onEditRow: (rowId: string) => void
  onUndoDelete: () => void
  lastDeleted: { row: Row; index: number } | null
}) {
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  const setCell = (row: Row, columnId: string, value: CellValue) => {
    onChangeCell(row.id, columnId, value)
  }

  const focusRow = (rowId: string) => {
    const element = rowRefs.current[rowId]?.querySelector<HTMLElement>('input, select, button')
    element?.focus()
  }

  // Which cells are covered by a cell that was stretched over them from above.
  const covered = (rowIndex: number, columnId: string) => {
    for (let back = 1; back <= rowIndex; back += 1) {
      if (groups[rowIndex - back]?.[columnId] && groups[rowIndex - back][columnId] > back) return true
    }
    return false
  }

  const leftAlign = (column: Column) =>
    column.type === 'amount' || column.type === 'quantity' ? 'text-right' : 'text-left'

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-brand-700 text-white">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={`border border-brand-800 px-3 py-2.5 text-xs font-bold whitespace-nowrap ${leftAlign(column)}`}
              >
                {column.name}
              </th>
            ))}
            <th scope="col" className="border border-brand-800 px-2 py-2.5 text-xs font-bold">
              Row
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-ink-500">
                Nothing here yet. Use the boxes above to add your first row.
              </td>
            </tr>
          ) : null}

          {rows.map((row, rowIndex) => {
            const info = groups[rowIndex] ?? {}
            return (
              <tr
                key={row.id}
                ref={(element) => {
                  rowRefs.current[row.id] = element
                }}
                className={rowIndex % 2 === 1 ? 'bg-slate-50' : 'bg-white'}
              >
                {columns.map((column) => {
                  if (covered(rowIndex, column.id)) return null
                  const span = settings.groupRows ? (info[column.id] ?? 1) : 1
                  return (
                    <td
                      key={column.id}
                      rowSpan={span > 1 ? span : undefined}
                      className={`border border-slate-200 px-1.5 py-1 align-middle ${
                        column.type === 'amount' || column.type === 'quantity' ? 'tabular' : ''
                      }`}
                    >
                      <CellEditor
                        column={column}
                        value={row.values[column.id]}
                        lists={lists.lists}
                        compact
                        ariaLabel={`${column.name}, row ${rowIndex + 1}`}
                        onChange={(value) => setCell(row, column.id, value)}
                        onCreateListValue={onCreateListValue}
                      />
                    </td>
                  )
                })}

                <td className="border border-slate-200 px-1 py-1 align-middle">
                  <div className="flex flex-col items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onEditRow(row.id)
                        focusRow(row.id)
                      }}
                      className="rounded border border-slate-300 px-1.5 py-0.5 text-xs font-semibold text-ink-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateRow(row.id)}
                      className="rounded border border-slate-300 px-1.5 py-0.5 text-xs font-semibold text-ink-700 hover:bg-slate-100"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRow(row.id)}
                      className="rounded border border-red-300 px-1.5 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>

        {rows.length > 0 ? (
          <tfoot>
            {/* The bar that names the column totals. */}
            <tr className="bg-slate-200">
              <td colSpan={columns.length + 1} className="border border-slate-300 px-3 py-2 text-center text-xs font-black tracking-widest text-ink-900">
                TOTALS PER COLUMN
              </td>
            </tr>
            <tr className="bg-white">
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={`border border-slate-300 px-3 py-2.5 text-sm font-bold ${
                    column.type === 'amount' || column.type === 'quantity' ? 'text-right tabular' : 'text-center text-ink-500'
                  }`}
                >
                  {column.type === 'amount' || column.type === 'quantity'
                    ? totalsCellText(column, rows, totals)
                    : ''}
                </td>
              ))}
              <td className="border border-slate-300" />
            </tr>

            <tr className="bg-brand-700 text-white">
              <td colSpan={columns.length + 1} className="border border-brand-800 px-3 py-3 text-center text-sm font-black tracking-widest">
                GRAND TOTAL&nbsp;&nbsp;{formatNumber(totals.grandTotal)}
              </td>
            </tr>

            {settings.showRowCount ? (
              <tr className="bg-slate-100">
                <td colSpan={columns.length + 1} className="border border-slate-300 px-3 py-2 text-center text-xs font-semibold text-ink-700">
                  ROWS WITH DETAILS: {formatNumber(totals.filledRowCount)} of {formatNumber(totals.visibleRowCount)} shown
                </td>
              </tr>
            ) : null}
          </tfoot>
        ) : null}
      </table>

      {rows.length > 0 && totals.summedColumns.some((column) => column.type === 'quantity') ? (
        <p className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-ink-500">
          The grand total adds up the Amount columns only. Quantity columns (litres, trips and the like) are
          totalled above but are not part of the grand total.
        </p>
      ) : null}

      {lastDeleted ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-amber-50 px-4 py-3">
          <span className="text-sm text-ink-700">One row was deleted.</span>
          <button
            type="button"
            onClick={onUndoDelete}
            className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100"
          >
            Undo the delete
          </button>
        </div>
      ) : null}
    </div>
  )
}
