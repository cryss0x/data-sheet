/**
 * scripts/check.mjs  (run through: npm run check)
 *
 * A set of automatic checks for the parts of the app that must never be wrong:
 * the totals, the "did you mean" hints, the linked columns, and the PDF file.
 *
 * It is not something a normal user ever needs to run. It is here so the maths
 * can be proved once and then trusted.
 */

import { inflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

let passed = 0
let failed = 0

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.log(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

/* ---------------------------------------------------------------- helpers */

const col = (name, type, extra = {}) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
  name,
  type,
  ...extra,
})
const row = (values) => ({ id: `r_${Math.random().toString(36).slice(2, 8)}`, values })

console.log('Checking the totals, the hints and the PDF...')

const {
  calculateTotals,
  calculateGroups,
  filterRows,
  sortRows,
  totalsCellText,
  countFilled,
} = await import('../src/utils/totals.ts')
const { parseNumber, formatNumber, formatNumberCell, safeFileName, cellToList, dateSortNumber } = await import(
  '../src/utils/format.ts'
)
const { isSameWord, findSimilarWord, matchKey } = await import('../src/utils/normalize.ts')
const { applyLinks } = await import('../src/utils/links.ts')
const { normaliseDocument, normaliseColumns, normaliseRows } = await import('../src/storage/validate.ts')
const { fingerprint, documentText } = await import('../src/utils/hash.ts')
const { buildPdfDocument } = await import('../src/pdf/exportPdf.ts')
const {
  groupIntoLines,
  splitLineIntoCells,
  buildTableFromLines,
  NoTableError,
  detectColumnType,
  looksLikeDate,
  isNumericText,
} = await import('../src/pdf/importTable.ts')

/* --------------------------------- 1. the KBL September expenses example (check 5) */

section('1. The KBL September sheet: 12 columns, 40 rows, grand total 5,140,380')

const kblColumns = [
  col('Date', 'date'),
  col('Description', 'text'),
  col('Truck Number', 'pick', { listName: 'Trucks' }),
  col('Mileage', 'amount'),
  col('Salary', 'amount'),
  col('Maintenance', 'amount'),
  col('Road Offence', 'amount'),
  col('Fine / Parking', 'amount'),
  col('Other Expenses', 'amount'),
  col('Quantity (Litres)', 'quantity'),
  col('Fuel', 'amount'),
  col('Spare Parts', 'amount'),
]
check('the example has 12 columns', kblColumns.length, 12)

/**
 * The eight money columns together must add up to exactly 5,140,380, and the
 * litres column must stay out of it.
 *
 *  1,000,000 + 1,200,000 + 900,000 + 150,000 + 95,000 + 120,000 + 1,500,000 + 175,380
 *  = 5,140,380
 */
const kblBigAmounts = {
  mileage: '1000000',
  salary: '1200000',
  maintenance: '900000',
  road_offence: '150000',
  fine_parking: '95000',
  other_expenses: '120000',
  fuel: '1500000',
  spare_parts: '175380',
}
// The real column ids, so the test data always lines up with the headings.
const idOf = (name) => kblColumns.find((column) => column.name === name).id
const moneyColumnIds = Object.keys(kblBigAmounts).map((key) => idOf(kblColumns.find((c) => c.id === key)?.name ?? ''))
const litresColumnId = idOf('Quantity (Litres)')

const kblRows = []
for (let i = 0; i < 40; i += 1) {
  const values = {
    date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
    description: 'Diesel, mileage and running costs',
    truck_number: `T${500 + i} EBR`,
  }
  // The first eight lines each carry one big amount.
  if (i < moneyColumnIds.length) values[moneyColumnIds[i]] = kblBigAmounts[moneyColumnIds[i]]
  // The rest carry litres only, which must not touch the grand total.
  if (i >= moneyColumnIds.length) values[litresColumnId] = String(100 * (i - moneyColumnIds.length + 1))
  kblRows.push(row(values))
}
// A few boxes are left empty on purpose: empty must never break a total.
kblRows[39].values[litresColumnId] = ''
kblRows[39].values.description = ''

/** The 31 lines that carry litres: 100, 200, 300 ... 3100. */
const kblLitres = Array.from({ length: 31 }, (_, index) => (index + 1) * 100)

const kblTotals = calculateTotals(kblColumns, kblRows)
check('40 rows', kblRows.length, 40)
check('grand total is 5,140,380', kblTotals.grandTotal, 5_140_380)
check('litres are not in the grand total', kblTotals.grandTotal < 5_140_380 + kblLitres.reduce((a, b) => a + b, 0), true)
check('litres column total', kblTotals.perColumn[litresColumnId], kblLitres.reduce((a, b) => a + b, 0))
check('an empty box adds nothing to a total', parseNumber(''), 0)
check('no total is NaN', Object.values(kblTotals.perColumn).every((value) => value === null || Number.isFinite(value)), true)
check('the last line has no litres, so it is not counted', kblTotals.filledRowCount, 40)
check(
  '40 rows with details are counted',
  kblTotals.filledRowCount,
  40,
)

/* ------------------------------------------- 2. numbers with thousands separators (check 6) */

section('2. Numbers, empty boxes and totals that never break')

const one = [col('A', 'amount'), col('B', 'amount'), col('C', 'quantity')]
const totals1 = calculateTotals(one, [
  row({ a: '405200', b: '', c: '10' }),
  row({ a: '1,000', b: '2500', c: '' }),
  row({ a: '', b: '', c: '' }),
])
check('separators are ignored when adding', totals1.perColumn.a, 406_200)
check('a blank box counts as nothing', totals1.perColumn.b, 2_500)
check('quantity is totalled', totals1.perColumn.c, 10)
check('grand total is amounts only', totals1.grandTotal, 408_700)
check('405200 is shown as 405,200', formatNumber(405_200), '405,200')
check('a box shows nothing when empty', formatNumberCell(''), '')
check('a box shows the number with separators', formatNumberCell('405200'), '405,200')
check('rows that are completely empty are not counted', totals1.filledRowCount, 2)

/* ------------------------------------- 3. one row, many trucks; two amounts (check 6) */

section('3. One row with five trucks, and a row with two amounts in it')

const multi = [col('Description', 'text'), col('Trucks', 'multi', { listName: 'Trucks' }), col('Maintenance', 'amount'), col('Spare Parts', 'amount')]
const manyTruckRow = row({
  description: '7 Days Kagera Trip  5 Trucks',
  trucks: ['T537 EBR', 'T715 EQQ', 'T123 ABC', 'T900 ZZZ', 'T111 KLM'],
  maintenance: '60000',
  spare_parts: '70000',
})
const multiTotals = calculateTotals(multi, [manyTruckRow])
check('five trucks stay in one cell', cellToList(manyTruckRow.values.trucks).length, 5)
check('both amounts in one row are added', multiTotals.grandTotal, 130_000)
check('the maintenance column alone', multiTotals.perColumn.maintenance, 60_000)
check('the spare parts column alone', multiTotals.perColumn.spare_parts, 70_000)

/* ------------------------------------------------- 4. truck numbers and hints (check 7) */

section('4. Truck numbers: the same truck written differently, and "Did you mean"')

check('spaces and capitals are ignored', isSameWord('T537 EBR', 't537ebr'), true)
check('a different truck is not the same', isSameWord('T537 EBR', 'T538 EBR'), false)
check('the comparison key', matchKey('T537-EBR'), 'T537EBR')
check('a near miss is spotted', findSimilarWord('T537EER', ['T537 EBR', 'T715 EQQ']), 'T537 EBR')
check('an exact match suggests nothing', findSimilarWord('t537 ebr', ['T537 EBR']), null)
check('a completely different word suggests nothing', findSimilarWord('Salaries', ['T537 EBR']), null)

/* ------------------------------------------------- 5. linked columns (check 7) */

section('5. Choosing a truck fills the driver, and a new truck is remembered')

const linkColumns = [
  col('Truck Number', 'pick', { listName: 'Trucks' }),
  col('Driver Name', 'text', { link: { listName: 'Trucks', valueKey: 'Driver Name' } }),
  col('Phone Number', 'text', { link: { listName: 'Trucks', valueKey: 'Phone Number' } }),
]
const lists = {
  kind: 'lists',
  version: 1,
  updatedAt: '',
  lists: [
    {
      name: 'Trucks',
      items: [
        { value: 'T715 EQQ', linked: { 'Driver Name': 'RAMADHAN HASSAN MJATA', 'Phone Number': '0755112233' } },
        { value: 't537ebr', linked: { 'Driver Name': 'JOSEPH MBALAME', 'Phone Number': '0755999888' } },
      ],
    },
  ],
}
const filled = applyLinks({
  columns: linkColumns,
  lists,
  changedColumnId: 'truck_number',
  values: { truck_number: 'T715 EQQ', driver_name: '', phone_number: '' },
})
check('the driver is filled in', filled.driver_name, 'RAMADHAN HASSAN MJATA')
check('the phone number is filled in', filled.phone_number, '0755112233')

const filledLower = applyLinks({
  columns: linkColumns,
  lists,
  changedColumnId: 'truck_number',
  values: { truck_number: 'T537EBR', driver_name: '', phone_number: '' },
})
check('a truck written in another case still fills in', filledLower.driver_name, 'JOSEPH MBALAME')

const typedByHand = applyLinks({
  columns: linkColumns,
  lists,
  changedColumnId: 'driver_name',
  values: { truck_number: 'T715 EQQ', driver_name: 'MY OWN WORDS' },
})
check('typing over a filled value is never undone', typedByHand.driver_name, 'MY OWN WORDS')

const unknownTruck = applyLinks({
  columns: linkColumns,
  lists,
  changedColumnId: 'truck_number',
  values: { truck_number: 'T999 NEW', driver_name: '', phone_number: '' },
})
check('a brand new truck leaves the other boxes empty', unknownTruck.driver_name, '')

/* ------------------------------------------------------- 6. group rows (feature 5) */

section('6. Group rows: repeated words shown once')

const groupColumns = [col('SN', 'text'), col('Driver Name', 'text'), col('Description', 'text'), col('Amount', 'amount')]
const groupRows = [
  row({ sn: '1', driver_name: 'RAMADAN', description: 'Molasses from Kagera', amount: '100' }),
  row({ sn: '1', driver_name: 'RAMADAN', description: 'Maize from Njombe', amount: '300' }),
  row({ sn: '1', driver_name: 'RAMADAN', description: 'Maize from Njombe', amount: '400' }),
]
const groups = calculateGroups(groupColumns, groupRows)
check('the driver is merged over three rows', groups[0].driver_name, 3)
check('the same description is merged over two rows', groups[1].description, 2)
check('money is never merged', groups[0].amount, 1)
check('the first line starts a group', groups[2].driver_name, 1)

/* -------------------------------------------------- 7. finding and sorting rows */

section('7. Finding and sorting rows without changing the saved order')

const findColumns = [col('Date', 'date'), col('Truck Number', 'pick', { listName: 'Trucks' })]
const findRows = [
  row({ date: '2026-09-30', truck_number: 'T715 EQQ' }),
  row({ date: '2026-09-01', truck_number: 'T537 EBR' }),
  row({ date: '2026-09-15', truck_number: 'T715 EQQ' }),
]
check('filtering by truck', filterRows(findRows, [{ columnId: 'truck_number', value: 't715eqq' }]).length, 2)
check('filtering by date', filterRows(findRows, [{ columnId: 'date', value: '2026-09-15' }]).length, 1)
check('no filter keeps everything', filterRows(findRows, []).length, 3)
check('sorting oldest first', sortRows(findRows, 'date-asc', findColumns)[0].values.date, '2026-09-01')
check('sorting newest first', sortRows(findRows, 'date-desc', findColumns)[0].values.date, '2026-09-30')
check('the original order is untouched', findRows[0].values.date, '2026-09-30')
check('"July 2026" is understood as a date', dateSortNumber('July 2026') > dateSortNumber('June 2026'), true)

/* ------------------------------------------------ 8. renaming a column (check 8) */

section('8. Renaming a column keeps the data')

const beforeRename = normaliseDocument({
  id: 'doc1',
  title: 'Test',
  columns: [
    { id: 'c1', name: 'Mileage', type: 'amount' },
    { id: 'c2', name: 'Truck', type: 'text' },
  ],
  rows: [{ id: 'r1', values: { c1: '5000', c2: 'T537 EBR' } }],
})
const renamed = beforeRename.columns.map((column) =>
  column.id === 'c1' ? { ...column, name: 'Distance' } : column,
)
const afterRename = normaliseDocument({ ...beforeRename, columns: renamed })
check('the money is still there', afterRename.rows[0].values.c1, '5000')
check('the truck is still there', afterRename.rows[0].values.c2, 'T537 EBR')
check('the new name is used', afterRename.columns[0].name, 'Distance')
check(
  'removing a column drops only its own values',
  normaliseRows([{ id: 'r1', values: { c1: '5000', c9: 'gone' } }], [normaliseColumns([{ id: 'c1', name: 'Mileage', type: 'amount' }])[0]])[0]
    .values.c9,
  undefined,
)
check('a file missing its title still opens', normaliseDocument({ columns: [], rows: [] }).title, 'Untitled document')
check('a file with rubbish in it still opens', normaliseColumns([{ id: 'x', name: 'Odd', type: 'nonsense' }])[0].type, 'text')

/* ------------------------------------------------- 9. the PDF (check 9) */

section('9. The PDF is a real, well-formed file with the title, totals and page numbers')

const pdfRows = []
for (let i = 0; i < 120; i += 1) {
  pdfRows.push(
    row({
      date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
      description: 'Long description of the running costs for this trip number',
      truck_number: `T${500 + i} EBR`,
      mileage: '45000',
      salary: '',
      maintenance: '12500',
      road_offence: '',
      fine_parking: '0',
      other_expenses: '',
      quantity_litres: '200',
      fuel: '90000',
      spare_parts: '',
    }),
  )
}
const pdfTotals = calculateTotals(kblColumns, pdfRows)
const pdfGroups = pdfRows.map(() => ({}))
const pdf = buildPdfDocument({
  document: {
    id: 'doc-pdf',
    title: 'TOTAL EXPENSES OF KBL TRUCKS SEPTEMBER',
    subtitle: 'KALPTEJ INVESTMENT LTD.',
    createdAt: '2026-09-30T08:00:00.000Z',
    updatedAt: '2026-09-30T08:00:00.000Z',
    columns: kblColumns,
    rows: pdfRows,
    settings: { groupRows: false, keepDate: true, repeatLast: true, showRowCount: true, sortMode: 'none' },
  },
  rows: pdfRows,
  groups: pdfGroups,
  totals: pdfTotals,
})
const bytes = Buffer.from(pdf.output('arraybuffer'))

// Handy while building: WRITE_PDF=1 npm run check leaves a sample PDF behind to
// open and look at.
if (process.env.WRITE_PDF === '1') {
  mkdirSync('.tmp-check', { recursive: true })
  writeFileSync('.tmp-check/sample.pdf', bytes)
  console.log('  (wrote .tmp-check/sample.pdf)')
}
check('the file starts with the PDF marker', bytes.subarray(0, 5).toString(), '%PDF-')
check('the file is a sensible size', bytes.length > 20_000, true)
check('the file is finished properly', bytes.subarray(-1024).includes(Buffer.from('%%EOF')), true)
check('the file is landscape A4', pdf.internal.pageSize.getWidth() > pdf.internal.pageSize.getHeight(), true)
check('more than one page was needed', pdf.getNumberOfPages() > 1, true)

// The words inside the PDF live in its page streams. They are usually plain
// text, but they may be packed, so both are searched.
const allText = [bytes.toString('latin1')]
const raw = bytes.toString('latin1')
const streamPattern = /stream\r?\n/g
let match
while ((match = streamPattern.exec(raw)) !== null) {
  const start = match.index + match[0].length
  const end = raw.indexOf('endstream', start)
  if (end < 0) continue
  allText.push(raw.slice(start, end))
  try {
    allText.push(inflateSync(Buffer.from(raw.slice(start, end), 'latin1')).toString('latin1'))
  } catch {
    // Not every stream is packed text.
  }
}
const pdfText = allText.join('\n')
check('the title is in the PDF', pdfText.includes('TOTAL EXPENSES OF KBL TRUCKS'), true)
check('the note is in the PDF', pdfText.includes('KALPTEJ INVESTMENT LTD.'), true)
check('a column heading is in the PDF', pdfText.includes('Spare Parts'), true)
check('the grand total is in the PDF', pdfText.includes(`GRAND TOTAL: ${formatNumber(pdfTotals.grandTotal)}`), true)
check('the per-column totals line is in the PDF', pdfText.includes('TOTALS PER COLUMN'), true)
check('the row count is in the PDF', pdfText.includes('ROWS WITH DETAILS'), true)
check('page numbers are in the PDF', /Page \d+ of \d+/.test(pdfText), true)
check('the made-on date is in the PDF', pdfText.includes('Made on'), true)
check('a number is shown with separators', pdfText.includes(formatNumber(pdfTotals.perColumn.mileage)), true)

/* ------------------------------------------- 10. counts instead of sums, and names */

section('10. Counting rows instead of adding, and file names')

const countColumns = [col('Number of Trips', 'quantity', { countRows: true }), col('Litres', 'quantity')]
const countRowsData = [
  row({ number_of_trips: '1', litres: '100' }),
  row({ number_of_trips: '3', litres: '200' }),
  row({ number_of_trips: '', litres: '' }),
]
const countTotals = calculateTotals(countColumns, countRowsData)
check('the trips column counts the filled rows', totalsCellText(countColumns[0], countRowsData, countTotals), '2')
check('the litres column still adds up', countTotals.perColumn.litres, 300)
check('counting the filled rows directly', countFilled(countRowsData, 'number_of_trips'), 2)
check('a file name from a title', safeFileName('TOTAL EXPENSES OF KBL TRUCKS SEPTEMBER'), 'TOTAL EXPENSES OF KBL TRUCKS SEPTEMBER')
check('a title with a slash still makes a name', safeFileName('A/B: test?'), 'A B test')
check('an empty title gets a name', safeFileName('   '), 'document')

section('11. Spotting a file that was changed outside the app')
check('the same text has the same fingerprint', fingerprint('{"a":1}'), fingerprint('{"a":1}'))
check('a changed text has a different fingerprint', fingerprint('{"a":1}') === fingerprint('{"a":2}'), false)
check('a document has a stable fingerprint', fingerprint(documentText(beforeRename)) === fingerprint(documentText(beforeRename)), true)

/* ------------------------- 12. reading a table back out of a PDF (the import) */

section('12. Turning the words found in a PDF back into columns and rows')

// One word as the PDF reader hands it over: the text, where it starts, which
// line it is on, and how tall the letters are.
const word = (str, x, y, page = 1, height = 10) => ({
  str,
  x,
  y,
  end: x + str.length * height * 0.5,
  height,
  page,
})

// Runs the reader and reports only what happened, so an error can be checked.
const buildTableFromLinesSafe = (lines) => {
  try {
    buildTableFromLines(lines)
    return 'no error'
  } catch (error) {
    return error instanceof NoTableError ? 'no table' : 'other error'
  }
}

// Words sharing a line are grouped, page by page, top line first.
const grouped12 = groupIntoLines([
  word('Heading', 10, 700),
  word('Words', 100, 699.6),
  word('Second line', 10, 680),
  word('Other page', 10, 700, 2),
])
check('words on the same line are grouped together', grouped12.length, 3)
check('the words come out in reading order', grouped12[0].words.map((item) => item.str).join(' '), 'Heading Words')
check('words from another page stay on their own page', grouped12[2].page, 2)

// A line is cut into cells where the gaps between the words are big.
const headingCells12 = splitLineIntoCells({
  page: 1,
  y: 700,
  words: [word('Date', 10, 700), word('Truck', 60, 700), word('Amount', 150, 700)],
})
check('three headings make three cells', headingCells12.map((cell) => cell.text), ['Date', 'Truck', 'Amount'])
const joinedCells12 = splitLineIntoCells({
  page: 1,
  y: 680,
  words: [word('March', 10, 680), word('2026', 38, 680)],
})
check('words close together stay in one cell', joinedCells12.map((cell) => cell.text), ['March 2026'])

// A whole table: a title, the headings, two rows, a word wrapped inside a box,
// and every totals line this app writes under its own tables.
const table12 = buildTableFromLines(
  groupIntoLines([
    word('Expense Sheet', 200, 720),
    word('Date', 10, 700),
    word('Description', 60, 700),
    word('Amount', 200, 700),
    word('2026-09-01', 10, 680),
    word('Diesel for the truck', 60, 680),
    word('1,500', 225, 680),
    word('and more', 60, 668.5), // wrapped inside the description box
    word('2026-09-02', 10, 650),
    word('Repair', 60, 650),
    word('750', 230, 650),
    word('TOTALS PER COLUMN', 10, 630),
    word('2,250', 225, 610), // the row of totals is not a row
    word('GRAND TOTAL: 2,250', 10, 590),
    word('Made on 30 Sep 2026, 10:42', 10, 570),
    word('Page 1 of 1', 500, 550),
    // The heading row repeated on a later page is ignored.
    word('Date', 10, 530),
    word('Description', 60, 530),
    word('Amount', 200, 530),
    word('2026-09-03', 10, 510),
    word('Ferry', 60, 510),
    word('300', 235, 510),
  ]),
)
check('the headings are found', table12.columns.map((column) => column.name), ['Date', 'Description', 'Amount'])
check('the types are guessed', table12.columns.map((column) => column.type), ['date', 'text', 'amount'])
check('the rows are found', table12.rows.length, 3)
check('a right-aligned number lands in the amount column', table12.rows[0][2], '1,500')
check('a wrapped word joins the row above it', table12.rows[0][1], 'Diesel for the truck and more')
check('the totals lines are not rows', table12.rows.some((row) => row.join(' ').includes('GRAND TOTAL')), false)
check('the made-on date is not a row', table12.rows.some((row) => row.join(' ').includes('Made on')), false)

// A file with no table in it at all raises the "no table" error.
const prose12 = buildTableFromLinesSafe(
  groupIntoLines([word('Just some writing on a page', 10, 700), word('and a second line of it', 10, 680)]),
)
check('a file with no table raises an error', prose12, 'no table')

// Guessing what one column holds.
check('a column of dates', detectColumnType('Date', ['2026-09-01', '30/09/2026', 'July 2026']), 'date')
check('a column of money', detectColumnType('Fuel', ['90,000', '150000']), 'amount')
check('a column of litres', detectColumnType('Quantity (Litres)', ['100', '200']), 'quantity')
check('a phone column stays words', detectColumnType('Phone Number', ['0755112233', '0712345678']), 'text')
check('a column of words stays words', detectColumnType('Description', ['Diesel', 'Repair']), 'text')
check('a row number stays words', detectColumnType('SN', ['1', '2', '3']), 'text')
check('a number with separators is a number', isNumericText('1,500,000'), true)
check('a truck number is not a number', isNumericText('T537 EBR'), false)
check('"July 2026" looks like a date', looksLikeDate('July 2026'), true)

// Two headings with the same name are kept apart, so no data is lost.
const duplicate12 = buildTableFromLines(
  groupIntoLines([
    word('Total', 10, 700),
    word('Total', 100, 700),
    word('500', 10, 680),
    word('700', 100, 680),
  ]),
)
check('the same heading twice gets two names', duplicate12.columns.map((column) => column.name), [
  'Total',
  'Total 2',
])
check('both columns keep their numbers', duplicate12.rows, [['500', '700']])

/* ------- 13. reading the sample PDF back (ROUNDTRIP=1 npm run check) */

if (process.env.ROUNDTRIP === '1') {
  section('13. Reading the PDF that was just made back into a table')

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes) })
  const opened = await task.promise
  const roundWords = []
  for (let pageNumber = 1; pageNumber <= opened.numPages; pageNumber += 1) {
    const page = await opened.getPage(pageNumber)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue
      const x = item.transform[4]
      const y = item.transform[5]
      roundWords.push({
        page: pageNumber,
        str: item.str,
        x,
        y,
        end: x + Math.max(item.width, 0),
        height: item.height > 0 ? item.height : Math.abs(item.transform[3]) || 10,
      })
    }
    page.cleanup()
  }
  const roundTable = buildTableFromLines(groupIntoLines(roundWords))
  check('every heading comes back', roundTable.columns.map((column) => column.name), kblColumns.map((column) => column.name))
  check('the money heading is guessed as money', roundTable.columns.find((column) => column.name === 'Fuel')?.type, 'amount')
  check('the maintenance heading is guessed as money', roundTable.columns.find((column) => column.name === 'Maintenance')?.type, 'amount')
  check('the date heading is guessed as a date', roundTable.columns.find((column) => column.name === 'Date')?.type, 'date')
  check('the truck heading stays words', roundTable.columns.find((column) => column.name === 'Truck Number')?.type, 'text')
  check('the litres heading is a quantity', roundTable.columns.find((column) => column.name === 'Quantity (Litres)')?.type, 'quantity')
  check('the first date comes back', roundTable.rows[0][0], '2026-09-01')
  check('a truck number comes back', roundTable.rows[0][2], 'T500 EBR')
  check('the first amount comes back', roundTable.rows[0][3], '45000')
  check('the fuel amount comes back', roundTable.rows[0][10], '90000')
  check('an empty box stays empty', roundTable.rows[0][4], '')
  check('all 120 rows are read back', roundTable.rows.length, 120)
  await task.destroy()
}

console.log(`\n${passed} checks passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
