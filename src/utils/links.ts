/**
 * utils/links.ts
 * --------------
 * The "linked columns" rule: when the user chooses a value in one column, other
 * columns can be filled in from the same saved list.
 *
 * For example, choosing truck number "T715 EQQ" in the Truck Number column fills
 * the Driver Name column with "RAMADHAN HASSAN MJATA", because that driver was
 * saved with that truck on the "Manage lists" screen.
 *
 * Only the column that was just changed is filled in, so a value the user typed
 * by hand is never overwritten.
 */

import type { CellValue, Column, ListsFile, Row } from '../types'
import { cellToList, cellToText } from './format'
import { isSameWord } from './normalize'

/**
 * Works out the values of one row after a cell was changed.
 * Returns a new set of values, or the same ones if nothing needed filling.
 */
export function applyLinks({
  columns,
  lists,
  changedColumnId,
  values,
}: {
  columns: Column[]
  lists: ListsFile
  changedColumnId: string
  values: Row['values']
}): Row['values'] {
  const changedColumn = columns.find((column) => column.id === changedColumnId)
  if (!changedColumn) return values
  if (changedColumn.type !== 'pick' && changedColumn.type !== 'multi') return values
  const sourceListName = changedColumn.listName
  if (!sourceListName) return values

  const sourceList = lists.lists.find((list) => list.name === sourceListName)
  if (!sourceList) return values

  // The columns that asked to be filled from this same list.
  const targets = columns.filter(
    (column) => column.id !== changedColumnId && column.link?.listName === sourceListName,
  )
  if (targets.length === 0) return values

  // A "pick several" column can fill several targets at once, one for each value.
  const chosen = cellToList(values[changedColumnId])
  const result: Row['values'] = { ...values }

  for (const target of targets) {
    const valueKey = target.link?.valueKey
    if (!valueKey) continue

    if (chosen.length === 0) {
      result[target.id] = target.type === 'multi' ? [] : ''
      continue
    }

    if (target.type === 'multi') {
      const filled: string[] = []
      for (const one of chosen) {
        const item = sourceList.items.find((candidate) => isSameWord(candidate.value, one))
        const linked = item?.linked[valueKey]
        if (linked && linked.trim() !== '' && !filled.some((existing) => isSameWord(existing, linked))) {
          filled.push(linked)
        }
      }
      result[target.id] = filled
      continue
    }

    const item = sourceList.items.find((candidate) => isSameWord(candidate.value, chosen[0]))
    const linked = item?.linked[valueKey]
    result[target.id] = linked && linked.trim() !== '' ? linked : ''
  }

  return result
}

/** Fills a brand new row in, used when copying a row or repeating values. */
export function fillLinkedValues({
  columns,
  lists,
  values,
}: {
  columns: Column[]
  lists: ListsFile
  values: Row['values']
}): Row['values'] {
  let result = { ...values }
  for (const column of columns) {
    if (column.type !== 'pick' && column.type !== 'multi') continue
    result = applyLinks({ columns, lists, changedColumnId: column.id, values: result })
  }
  return result
}

/** The words of a cell as one piece of text (used in the print and PDF views). */
export function displayText(value: CellValue | undefined): string {
  return cellToText(value)
}
