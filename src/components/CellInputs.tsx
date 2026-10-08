/**
 * components/CellInputs.tsx
 * ------------------------
 * The little boxes the user types into: numbers, dates, drop-down lists from
 * saved lists, and one box that can hold several words as tags.
 *
 * All of them follow the same simple rules:
 *   - a big, clear box,
 *   - you may pick a saved value OR type a new one,
 *   - anything typed that looks like a saved value gets a gentle
 *     "Did you mean ...?" hint,
 *   - a new word is remembered in the saved list for next time.
 */

import { useEffect, useRef, useState } from 'react'
import type { CellValue, Column, SavedList } from '../types'
import { cellToList, cellToText, cleanNumberText, formatNumberCell, toDateInputValue } from '../utils/format'
import { findSimilarWord, isSameWord } from '../utils/normalize'

/** The list a column uses, or an empty list while the app is opening. */
export function listFor(lists: SavedList[], name: string | undefined): SavedList | undefined {
  if (!name) return undefined
  return lists.find((list) => list.name === name)
}

/* ------------------------------------------------------------------- numbers */

/**
 * A money or quantity box. Only numbers can be typed, and the number is shown
 * with thousands separators as it is entered: 405200 becomes "405,200".
 */
export function NumberField({
  value,
  onChange,
  compact = false,
  ariaLabel,
}: {
  value: CellValue | undefined
  onChange: (value: string) => void
  compact?: boolean
  ariaLabel?: string
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={formatNumberCell(value)}
      placeholder="0"
      onChange={(event) => onChange(cleanNumberText(event.target.value))}
      onFocus={(event) => event.currentTarget.select()}
      className={`amount-input w-full rounded-lg border border-slate-300 bg-white font-semibold text-ink-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200 ${
        compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2.5 text-base'
      }`}
    />
  )
}

/* --------------------------------------------------------------------- dates */

/**
 * A date box. Words such as "July 2026" are allowed, because some records only
 * have a month, and there is a small calendar button for the usual case.
 */
export function DateField({
  value,
  onChange,
  compact = false,
  ariaLabel,
}: {
  value: CellValue | undefined
  onChange: (value: string) => void
  compact?: boolean
  ariaLabel?: string
}) {
  const picker = useRef<HTMLInputElement>(null)
  const text = cellToText(value)

  const openPicker = () => {
    const input = picker.current
    if (!input) return
    // Browsers only allow the calendar to open from a real click.
    if (typeof input.showPicker === 'function') input.showPicker()
    else input.click()
  }

  return (
    <div className="flex w-full items-center gap-1">
      <input
        type="text"
        aria-label={ariaLabel}
        value={text}
        placeholder="2026-09-30 or July 2026"
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        className={`w-full rounded-lg border border-slate-300 bg-white text-ink-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200 ${
          compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2.5 text-base'
        }`}
      />
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={toDateInputValue(value)}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <button
        type="button"
        title="Open the calendar"
        onClick={openPicker}
        className={`shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-2 hover:bg-slate-100 ${
          compact ? 'py-1.5 text-sm' : 'py-2.5 text-base'
        }`}
      >
        📅
      </button>
    </div>
  )
}

/* --------------------------------------------------------------------- lists */

/** The gentle "Did you mean ...?" hint shown under a box. */
function Suggestion({
  suggestion,
  onUse,
  compact = false,
}: {
  suggestion: string | null
  onUse: () => void
  compact?: boolean
}) {
  if (!suggestion) return null
  return (
    <div className={`mt-1 flex items-center gap-2 text-amber-800 ${compact ? 'text-xs' : 'text-sm'}`}>
      <span>Did you mean {suggestion}?</span>
      <button
        type="button"
        onClick={onUse}
        className="rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 font-semibold hover:bg-amber-100"
      >
        Use {suggestion}
      </button>
    </div>
  )
}

/**
 * A drop-down of saved values. You can also type a brand new value, and it is
 * added to the list straight away so it is there next time.
 */
export function ListPicker({
  items,
  value,
  onChange,
  onCreate,
  compact = false,
  ariaLabel,
  emptyText = 'No saved values yet - type a new one below',
}: {
  items: string[]
  value: string
  onChange: (value: string) => void
  onCreate?: (value: string) => void
  compact?: boolean
  ariaLabel?: string
  emptyText?: string
}) {
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const typingRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typing) typingRef.current?.focus()
  }, [typing])

  /** Puts the drop-down back and clears the typing box. */
  const setTypingOff = () => {
    setTyping(false)
    setDraft('')
  }

  /** Takes what was typed and uses it as the value. */
  const commit = (raw: string) => {
    const typed = raw.trim()
    setTypingOff()
    if (typed === '') return
    onChange(typed)
    // Remember a new word for next time (the list itself checks for duplicates).
    onCreate?.(typed)
  }

  // Only offer the hint when what is typed is not already in the list.
  const shownSuggestion = draft.trim() !== '' ? findSimilarWord(draft, items) : null

  return (
    <div className="w-full">
      {!typing ? (
        <select
          aria-label={ariaLabel}
          value={items.some((item) => isSameWord(item, value)) && value !== '' ? value : ''}
          onChange={(event) => {
            const chosen = event.target.value
            if (chosen === '__new__') {
              setTyping(true)
              setDraft('')
              return
            }
            onChange(chosen)
          }}
          className={`w-full rounded-lg border border-slate-300 bg-white text-ink-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200 ${
            compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2.5 text-base'
          }`}
        >
          <option value="">{value !== '' && value.trim() !== '' ? value : '— Choose —'}</option>
          {items.length === 0 ? <option value="__new__">Type a new value…</option> : null}
          {items.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
          {items.length > 0 ? <option value="__new__">＋ Type a new value…</option> : null}
        </select>
      ) : (
        <div className="flex w-full items-center gap-1">
          <input
            ref={typingRef}
            aria-label={ariaLabel}
            value={draft}
            placeholder="Type a new value"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit(draft)
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setTypingOff()
              }
            }}
            className={`w-full rounded-lg border-2 border-brand-500 bg-white text-ink-900 outline-none focus:ring-2 focus:ring-brand-200 ${
              compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2.5 text-base'
            }`}
          />
          <button
            type="button"
            title="Cancel"
            onMouseDown={(event) => event.preventDefault()}
            onClick={setTypingOff}
            className="shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-2 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
      )}

      {typing && items.length === 0 && draft === '' ? (
        <p className="mt-1 text-xs text-ink-500">{emptyText}</p>
      ) : (
        <Suggestion
          suggestion={shownSuggestion}
          compact={compact}
          onUse={() => {
            onChange(shownSuggestion as string)
            setTypingOff()
          }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------- tags */

/**
 * One box that holds several words, shown as small tags. This is how one row can
 * name five trucks at once.
 */
export function TagPicker({
  items,
  values,
  onChange,
  onCreate,
  compact = false,
  ariaLabel,
}: {
  items: string[]
  values: string[]
  onChange: (values: string[]) => void
  onCreate?: (value: string) => void
  compact?: boolean
  ariaLabel?: string
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const typingRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) typingRef.current?.focus()
  }, [adding])

  const add = (raw: string) => {
    const typed = raw.trim()
    setAdding(false)
    setDraft('')
    if (typed === '') return
    // The same word is never added twice.
    if (values.some((item) => isSameWord(item, typed))) return
    onChange([...values, typed])
    onCreate?.(typed)
  }

  const remaining = items.filter((item) => !values.some((current) => isSameWord(current, item)))

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-1">
        {values.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800"
          >
            {item}
            <button
              type="button"
              title={`Remove ${item}`}
              onClick={() => onChange(values.filter((current) => !isSameWord(current, item)))}
              className="text-brand-700 hover:text-red-700"
            >
              ×
            </button>
          </span>
        ))}

        {!adding ? (
          <select
            aria-label={ariaLabel}
            value=""
            onChange={(event) => {
              if (event.target.value === '__new__') {
                setAdding(true)
                setDraft('')
                return
              }
              if (event.target.value !== '') add(event.target.value)
            }}
            className={`rounded-lg border border-dashed border-slate-400 bg-white text-ink-700 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200 ${
              compact ? 'px-1.5 py-1 text-xs' : 'px-2 py-1.5 text-sm'
            }`}
          >
            <option value="">＋ Add</option>
            {remaining.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            <option value="__new__">Type a new value…</option>
          </select>
        ) : (
          <div className="flex items-center gap-1">
            <input
              ref={typingRef}
              aria-label="Type a new value"
              value={draft}
              placeholder="Type a new value"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => add(draft)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  add(draft)
                }
              }}
              className="w-40 rounded-lg border-2 border-brand-500 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-200"
            />
            <button
              type="button"
              title="Cancel"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setAdding(false)
                setDraft('')
              }}
              className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-sm hover:bg-slate-100"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {adding ? (
        <Suggestion
          suggestion={findSimilarWord(draft, items)}
          compact={compact}
          onUse={() => add(findSimilarWord(draft, items) as string)}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------ the box for a column */

/**
 * Shows the right box for a column. Used in the entry form and for editing a
 * cell straight in the table.
 */
export function CellEditor({
  column,
  value,
  lists,
  onChange,
  onCreateListValue,
  compact = false,
  ariaLabel,
}: {
  column: Column
  value: CellValue | undefined
  lists: SavedList[]
  onChange: (value: CellValue) => void
  /** Called when the user types a brand new word, so it is remembered. */
  onCreateListValue?: (listName: string, value: string) => void
  compact?: boolean
  ariaLabel?: string
}) {
  const list = listFor(lists, column.listName)
  const items = (list?.items ?? []).map((item) => item.value)

  // A new word is added to the saved list, but only if the list is really there.
  const create = (newValue: string) => {
    if (list && onCreateListValue) onCreateListValue(list.name, newValue)
  }

  if (column.type === 'amount' || column.type === 'quantity') {
    return (
      <NumberField
        value={value}
        ariaLabel={ariaLabel ?? column.name}
        compact={compact}
        onChange={(text) => onChange(text)}
      />
    )
  }

  if (column.type === 'date') {
    return (
      <DateField
        value={value}
        ariaLabel={ariaLabel ?? column.name}
        compact={compact}
        onChange={(text) => onChange(text)}
      />
    )
  }

  if (column.type === 'pick') {
    return (
      <ListPicker
        items={items}
        value={cellToText(value)}
        ariaLabel={ariaLabel ?? column.name}
        compact={compact}
        onChange={(text) => onChange(text)}
        onCreate={list ? create : undefined}
      />
    )
  }

  if (column.type === 'multi') {
    return (
      <TagPicker
        items={items}
        values={cellToList(value)}
        ariaLabel={ariaLabel ?? column.name}
        compact={compact}
        onChange={(next) => onChange(next)}
        onCreate={list ? create : undefined}
      />
    )
  }

  return (
    <input
      type="text"
      aria-label={ariaLabel ?? column.name}
      value={cellToText(value)}
      placeholder=""
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      className={`w-full rounded-lg border border-slate-300 bg-white text-ink-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200 ${
        compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2.5 text-base'
      }`}
    />
  )
}
