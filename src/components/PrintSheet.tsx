/**
 * components/PrintSheet.tsx
 * ------------------------
 * The layout used by the "Print" button. It is the same shape as the PDF -
 * title, note, table, totals - laid out by the browser itself, so the printed
 * page comes out looking like the exported PDF.
 *
 * This part is hidden on screen and only appears when printing.
 */

import type { Column, Row, SheetSettings } from '../types'
import { cellToList, cellToText, formatDateTime, formatNumber } from '../utils/format'
import type { GroupInfo, TotalsResult } from '../utils/totals'
import { totalsCellText } from '../utils/totals'

export function PrintSheet({
  title,
  subtitle,
  columns,
  rows,
  groups,
  totals,
  settings,
}: {
  title: string
  subtitle: string
  columns: Column[]
  rows: Row[]
  groups: GroupInfo[]
  totals: TotalsResult
  settings: SheetSettings
}) {
  const isNumberColumn = (column: Column) => column.type === 'amount' || column.type === 'quantity'

  const covered = (rowIndex: number, columnId: string) => {
    for (let back = 1; back <= rowIndex; back += 1) {
      const span = groups[rowIndex - back]?.[columnId] ?? 1
      if (span > back) return true
    }
    return false
  }

  return (
    <div className="print-only">
      <h1 className="text-center text-2xl font-black">{title}</h1>
      {subtitle.trim() !== '' ? (
        <p className="mt-1 text-center text-base font-semibold">{subtitle.trim()}</p>
      ) : null}

      <table className="mt-4 w-full border-collapse text-[10px]">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                className={`border border-slate-500 bg-slate-200 px-1.5 py-1 font-bold ${
                  isNumberColumn(column) ? 'text-right' : 'text-left'
                }`}
              >
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id}>
              {columns.map((column) => {
                if (covered(rowIndex, column.id)) return null
                const span = settings.groupRows ? (groups[rowIndex]?.[column.id] ?? 1) : 1
                const list = cellToList(row.values[column.id])
                return (
                  <td
                    key={column.id}
                    rowSpan={span > 1 ? span : undefined}
                    className={`border border-slate-400 px-1.5 py-1 align-top ${
                      isNumberColumn(column) ? 'text-right' : 'text-left'
                    }`}
                  >
                    {list.length > 1
                      ? list.map((item) => (
                          <div key={item}>{item}</div>
                        ))
                      : cellToText(row.values[column.id])}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={columns.length} className="border border-slate-500 bg-slate-100 px-1.5 py-1 text-center font-bold">
              TOTALS PER COLUMN
            </td>
          </tr>
          <tr>
            {columns.map((column) => (
              <td
                key={column.id}
                className={`border border-slate-400 px-1.5 py-1 font-bold ${
                  isNumberColumn(column) ? 'text-right' : 'text-center'
                }`}
              >
                {isNumberColumn(column) ? totalsCellText(column, rows, totals) : ''}
              </td>
            ))}
          </tr>
          <tr>
            <td
              colSpan={columns.length}
              className="border border-slate-500 bg-slate-700 px-1.5 py-1.5 text-center font-black text-white"
            >
              GRAND TOTAL&nbsp;&nbsp;{formatNumber(totals.grandTotal)}
            </td>
          </tr>
          {settings.showRowCount ? (
            <tr>
              <td colSpan={columns.length} className="border border-slate-400 px-1.5 py-1 text-center font-semibold">
                ROWS WITH DETAILS: {formatNumber(totals.filledRowCount)}
              </td>
            </tr>
          ) : null}
        </tfoot>
      </table>

      <p className="mt-3 text-center text-[10px] text-slate-600">
        Made on {formatDateTime(new Date().toISOString())}
      </p>
    </div>
  )
}
