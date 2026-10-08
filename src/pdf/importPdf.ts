/**
 * pdf/importPdf.ts
 * ----------------
 * Reading a PDF file that is already saved on this computer, finding the words
 * inside it, and handing them to importTable.ts to be turned into columns and
 * rows.
 *
 * The PDF reader is only fetched when the "Import PDF" button is pressed, so it
 * never slows the rest of the app down. Nothing is ever sent anywhere: the file
 * is read straight from this computer.
 */

import { buildTableFromLines, groupIntoLines } from './importTable'
import type { ParsedTable, PdfWord } from './importTable'

/** What is found in one PDF file. */
export interface PdfImportResult {
  table: ParsedTable
  /** The title saved inside the PDF file, if it has one. */
  pdfTitle: string
  pageCount: number
}

/** Reads one chosen PDF file and returns the table found in it. */
export async function readPdfTable(file: File): Promise<PdfImportResult> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const loading = pdfjs.getDocument({ data: await file.arrayBuffer() })
  const pdf = await loading.promise
  try {
    const words: PdfWord[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (!('str' in item)) continue
        const str = item.str.replace(/\u00a0/g, ' ')
        if (str.trim() === '') continue
        const x = item.transform[4]
        const y = item.transform[5]
        const height = item.height > 0 ? item.height : Math.abs(item.transform[3]) || 10
        words.push({ page: pageNumber, str, x, y, end: x + Math.max(item.width, 0), height })
      }
      page.cleanup()
    }

    let pdfTitle = ''
    const metadata = await pdf.getMetadata().catch(() => null)
    const info = metadata?.info as { Title?: unknown } | undefined
    if (typeof info?.Title === 'string') pdfTitle = info.Title.trim()

    return {
      table: buildTableFromLines(groupIntoLines(words)),
      pdfTitle,
      pageCount: pdf.numPages,
    }
  } finally {
    await loading.destroy()
  }
}
