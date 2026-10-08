/**
 * pdf/exportPdf.ts
 * ----------------
 * Makes the PDF file, right inside the browser. Nothing is uploaded anywhere.
 *
 * The PDF is built to look like an official report:
 *   - the document title at the top, big and centred,
 *   - the optional note underneath it,
 *   - the whole table, with the heading row repeated on every page,
 *   - the totals lines at the end,
 *   - landscape A4, so wide tables fit,
 *   - "Page 1 of 3" at the bottom and the date the file was made.
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Column, Row, SheetDocument } from '../types'
import { cellToText, formatDateTime, formatNumber, safeFileName } from '../utils/format'
import { totalsCellText } from '../utils/totals'
import type { GroupInfo, TotalsResult } from '../utils/totals'

/** A colour used for the heading row: the same teal as the app. */
const HEAD_COLOUR: [number, number, number] = [15, 118, 110]
const TOTAL_COLOUR: [number, number, number] = [226, 232, 240]
const GRAND_COLOUR: [number, number, number] = [15, 118, 110]

/** The text size that suits the number of columns, so nothing becomes unreadable. */
function fontSizeFor(columnCount: number): number {
  if (columnCount <= 5) return 10
  if (columnCount <= 8) return 9
  if (columnCount <= 11) return 8
  if (columnCount <= 15) return 7
  return 6
}

/**
 * One cell for the PDF: either plain text, or a little box of instructions
 * ("span these two columns", "make this line dark").
 */
export type PdfCell =
  | string
  | {
      content: string
      rowSpan?: number
      colSpan?: number
      styles?: {
        fillColor?: [number, number, number]
        textColor?: [number, number, number]
        fontStyle?: 'bold' | 'normal' | 'italic'
        halign?: 'left' | 'center' | 'right'
        fontSize?: number
      }
    }

/** One table line: the cells, in column order, keyed by their position. */
export type PdfRow = Record<string, PdfCell>

/** Turns one row of the document into the cells the PDF library understands. */
function bodyCells(
  row: Row,
  columns: Column[],
  groupInfo: GroupInfo | undefined,
  useGroups: boolean,
): PdfRow {
  const cells: PdfRow = {}

  columns.forEach((column, index) => {
    const value = cellToText(row.values[column.id])
    const span = useGroups ? (groupInfo?.[column.id] ?? 1) : 1
    cells[String(index)] = span > 1 ? { content: value, rowSpan: span } : value
  })

  return cells
}

/**
 * Builds the PDF and hands it back, so it can be saved, previewed or checked.
 */
export function buildPdfDocument({
  document,
  rows,
  groups,
  totals,
}: {
  document: SheetDocument
  rows: Row[]
  groups: GroupInfo[]
  totals: TotalsResult
}): jsPDF {
  const { columns, settings } = document
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const fontSize = fontSizeFor(columns.length)

  // The title, centred at the top of the first page.
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  const titleLines = pdf.splitTextToSize(document.title, pageWidth - margin * 2) as string[]
  pdf.text(titleLines, pageWidth / 2, margin + 4, { align: 'center' })

  let underTitle = margin + 4 + titleLines.length * 6

  if (document.subtitle.trim() !== '') {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    const subtitleLines = pdf.splitTextToSize(document.subtitle.trim(), pageWidth - margin * 2) as string[]
    pdf.text(subtitleLines, pageWidth / 2, underTitle + 2, { align: 'center' })
    underTitle += 2 + subtitleLines.length * 5
  }

  // Every amount and quantity column is lined up on the right.
  const columnStyles: Record<string, { halign: 'right' | 'left' }> = {}
  columns.forEach((column, index) => {
    columnStyles[String(index)] =
      column.type === 'amount' || column.type === 'quantity' ? { halign: 'right' } : { halign: 'left' }
  })

  // The totals lines are added as extra rows at the end of the table, so they
  // always sit directly under the last line of data.
  const footerRows: PdfRow[] = [
    {
      0: {
        content: 'TOTALS PER COLUMN',
        colSpan: columns.length,
        styles: {
          fillColor: TOTAL_COLOUR,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: fontSize + 0.5,
        },
      },
    },
    {},
  ]

  const perColumnCells: PdfRow = {}
  columns.forEach((column, index) => {
    perColumnCells[String(index)] =
      column.type === 'amount' || column.type === 'quantity'
        ? { content: totalsCellText(column, rows, totals), styles: { halign: 'right', fontStyle: 'bold' } }
        : ''
  })
  Object.assign(footerRows[1], perColumnCells)

  footerRows.push({
    0: {
      content: `GRAND TOTAL: ${formatNumber(totals.grandTotal)}`,
      colSpan: columns.length,
      styles: {
        fillColor: GRAND_COLOUR,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: fontSize + 1.5,
      },
    },
  })

  if (settings.showRowCount) {
    footerRows.push({
      0: {
        content: `ROWS WITH DETAILS: ${formatNumber(totals.filledRowCount)}`,
        colSpan: columns.length,
        styles: { fillColor: TOTAL_COLOUR, halign: 'center', fontStyle: 'bold' },
      },
    })
  }

  const body = rows.map((row, index) => bodyCells(row, columns, groups[index], settings.groupRows))
  body.push(...footerRows)

  autoTable(pdf, {
    startY: underTitle + 6,
    margin: { left: margin, right: margin, top: underTitle + 6, bottom: 16 },
    head: [columns.map((column) => column.name)],
    body,
    // The heading row is repeated on every page.
    showHead: 'everyPage',
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize,
      cellPadding: 1.6,
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: HEAD_COLOUR,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      minCellHeight: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
    didDrawPage: () => {
      // The date of the export, at the bottom of every page.
      const madeOn = `Made on ${formatDateTime(new Date().toISOString())}`
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(100, 116, 139)
      pdf.text(madeOn, margin, pageHeight - 6)
      // A thin line above the footer.
      pdf.setDrawColor(203, 213, 225)
      pdf.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9)
    },
  })

  // The page numbers are written once the whole table is done, because only then
  // is it known how many pages there are.
  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(100, 116, 139)
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' })
  }

  return pdf
}

/**
 * Builds the PDF and downloads it to the computer.
 *
 * It exports the rows that are on screen, so a filter or a sort is respected -
 * which is almost always what the user wants to send to somebody.
 */
export function exportDocumentToPdf(options: {
  document: SheetDocument
  rows: Row[]
  groups: GroupInfo[]
  totals: TotalsResult
}): void {
  const pdf = buildPdfDocument(options)
  pdf.save(`${safeFileName(options.document.title)}.pdf`)
}
