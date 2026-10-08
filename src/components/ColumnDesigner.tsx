/**
 * components/ColumnDesigner.tsx
 * -----------------------------
 * The screen for shaping the table: add a column, rename it, move it, change
 * what kind of information it holds, or remove it.
 *
 * Two things are carefully protected here:
 *   - renaming a column never touches the data already entered, because the data
 *     is stored against the column's hidden id, not its name;
 *   - removing a column always asks first, and says how much data would go.
 */

import { useMemo, useState } from 'react'
import { COLUMN_TYPES } from '../constants'
import type { Column, ColumnType, SavedList } from '../types'
import { cellToText } from '../utils/format'
import { newId } from '../utils/id'
import { Button, Checkbox, Modal, Select, TextField } from './ui'

/** Every extra word that the saved lists can fill in, e.g. "Driver Name". */
function linkedKeys(lists: SavedList[]): { listName: string; valueKey: string }[] {
  const found: { listName: string; valueKey: string }[] = []
  for (const list of lists) {
    const keys = new Set<string>()
    for (const item of list.items) {
      for (const key of Object.keys(item.linked)) {
        if (key.trim() !== '') keys.add(key.trim())
      }
    }
    for (const key of keys) found.push({ listName: list.name, valueKey: key })
  }
  return found
}

export function ColumnDesigner({
  columns,
  rows,
  lists,
  onSave,
  onClose,
}: {
  columns: Column[]
  rows: { values: Record<string, unknown> }[]
  lists: SavedList[]
  onSave: (columns: Column[]) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Column[]>(columns)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<ColumnType>('amount')
  const [newList, setNewList] = useState<string>(lists[0]?.name ?? '')
  const [askingToDelete, setAskingToDelete] = useState<{ column: Column; filled: number } | null>(null)

  const allLinks = useMemo(() => linkedKeys(lists), [lists])

  const update = (id: string, change: Partial<Column>) => {
    setDraft((current) =>
      current.map((column) => (column.id === id ? { ...column, ...change } : column)),
    )
  }

  const move = (id: string, direction: -1 | 1) => {
    setDraft((current) => {
      const index = current.findIndex((column) => column.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  const add = () => {
    const name = newName.trim()
    if (name === '') return
    const column: Column = { id: newId('col'), name, type: newType }
    if (newType === 'pick' || newType === 'multi') column.listName = newList
    setDraft((current) => [...current, column])
    setNewName('')
  }

  const remove = (id: string) => {
    setDraft((current) => current.filter((column) => column.id !== id))
    setAskingToDelete(null)
  }

  const howManyFilled = (columnId: string) =>
    rows.filter((row) => cellToText(row.values[columnId] as never).trim() !== '').length

  return (
    <Modal title="Design your columns" onClose={onClose} wide>
      <p className="mb-4 text-sm text-ink-500">
        A column is one heading in your table. You can add, rename, move or remove them at any time -
        your data is kept safe.
      </p>

      <div className="space-y-3">
        {draft.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-ink-500">
            No columns yet. Add your first one below.
          </p>
        ) : null}

        {draft.map((column, index) => {
          const linkSource = allLinks.filter((link) => link.listName === column.link?.listName)
          return (
            <div key={column.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-48 flex-1">
                  <label className="mb-1 block text-xs font-bold text-ink-500 uppercase">Column name</label>
                  <TextField value={column.name} onChange={(value) => update(column.id, { name: value })} />
                </div>

                <div className="w-44">
                  <label className="mb-1 block text-xs font-bold text-ink-500 uppercase">Kind of information</label>
                  <Select
                    value={column.type}
                    onChange={(value) => {
                      const type = value as ColumnType
                      const change: Partial<Column> = { type }
                      if (type !== 'quantity') delete change.countRows
                      if (type !== 'pick' && type !== 'multi') {
                        delete change.listName
                        delete change.link
                      }
                      update(column.id, change)
                    }}
                    options={COLUMN_TYPES.map((type) => ({ value: type.value, label: type.label }))}
                  />
                </div>

                {column.type === 'pick' || column.type === 'multi' ? (
                  <div className="w-44">
                    <label className="mb-1 block text-xs font-bold text-ink-500 uppercase">Saved list to use</label>
                    <Select
                      value={column.listName ?? ''}
                      onChange={(value) => update(column.id, { listName: value })}
                      options={lists.map((list) => ({ value: list.name, label: list.name }))}
                    />
                  </div>
                ) : null}

                <div className="flex gap-1.5">
                  <SmallButton onClick={() => move(column.id, -1)} disabled={index === 0} title="Move left">
                    ←
                  </SmallButton>
                  <SmallButton
                    onClick={() => move(column.id, 1)}
                    disabled={index === draft.length - 1}
                    title="Move right"
                  >
                    →
                  </SmallButton>
                  <SmallButton
                    onClick={() =>
                      setAskingToDelete({ column, filled: howManyFilled(column.id) })
                    }
                    title="Remove this column"
                    danger
                  >
                    ✕
                  </SmallButton>
                </div>
              </div>

              <p className="mt-1.5 text-xs text-ink-500">
                {COLUMN_TYPES.find((type) => type.value === column.type)?.hint}
              </p>

              {column.type === 'quantity' ? (
                <div className="mt-2">
                  <Checkbox
                    checked={column.countRows === true}
                    onChange={(checked) => update(column.id, { countRows: checked })}
                    label="Show how many rows were filled in, instead of a sum"
                  />
                </div>
              ) : null}

              {column.type === 'pick' || column.type === 'multi' || column.type === 'text' ? (
                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5">
                  <Checkbox
                    checked={column.link !== undefined}
                    onChange={(checked) => {
                      if (!checked) {
                        update(column.id, { link: undefined })
                        return
                      }
                      const first = allLinks[0]
                      update(column.id, {
                        link: first ? { listName: first.listName, valueKey: first.valueKey } : undefined,
                      })
                    }}
                    label="Fill this automatically from a saved list"
                  />
                  {column.link ? (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <div className="w-48">
                        <label className="mb-1 block text-xs font-bold text-ink-500 uppercase">Look in list</label>
                        <Select
                          value={column.link.listName}
                          onChange={(value) => {
                            const firstForList = allLinks.find((link) => link.listName === value)
                            update(column.id, {
                              link: {
                                listName: value,
                                valueKey: firstForList?.valueKey ?? '',
                              },
                            })
                          }}
                          options={Array.from(new Set(allLinks.map((link) => link.listName))).map((name) => ({
                            value: name,
                            label: name,
                          }))}
                        />
                      </div>
                      <div className="w-56">
                        <label className="mb-1 block text-xs font-bold text-ink-500 uppercase">Copy this value</label>
                        <Select
                          value={column.link.valueKey}
                          onChange={(value) => update(column.id, { link: { ...column.link!, valueKey: value } })}
                          options={linkSource.map((link) => ({ value: link.valueKey, label: link.valueKey }))}
                        />
                      </div>
                      <p className="flex-1 text-xs text-ink-500">
                        For example, choosing a truck in “Truck Number” fills this column with the driver saved
                        with that truck. You can always type over it by hand.
                      </p>
                    </div>
                  ) : allLinks.length === 0 ? (
                    <p className="mt-2 text-xs text-amber-800">
                      No saved words to copy yet. Add them first on the “Manage lists” screen.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Add a new column */}
      <div className="mt-5 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 p-3">
        <p className="mb-2 text-sm font-bold text-brand-800">Add a column</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs font-bold text-ink-500 uppercase">Column name</label>
            <TextField value={newName} onChange={setNewName} placeholder="For example: Mileage" />
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs font-bold text-ink-500 uppercase">Kind of information</label>
            <Select
              value={newType}
              onChange={(value) => setNewType(value as ColumnType)}
              options={COLUMN_TYPES.map((type) => ({ value: type.value, label: type.label }))}
            />
          </div>
          {newType === 'pick' || newType === 'multi' ? (
            <div className="w-44">
              <label className="mb-1 block text-xs font-bold text-ink-500 uppercase">Saved list to use</label>
              <Select
                value={newList}
                onChange={setNewList}
                options={lists.map((list) => ({ value: list.name, label: list.name }))}
              />
            </div>
          ) : null}
          <Button kind="primary" onClick={add} disabled={newName.trim() === ''}>
            Add column
          </Button>
        </div>
      </div>

      {/* The "are you sure" for removing a column */}
      {askingToDelete ? (
        <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-3">
          <p className="text-sm font-bold text-red-900">Remove the column “{askingToDelete.column.name}”?</p>
          <p className="mt-1 text-sm text-red-900">
            {askingToDelete.filled > 0
              ? `${askingToDelete.filled} row(s) have information in this column, and that information will be removed.`
              : 'This column is empty, so nothing will be lost.'}
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => setAskingToDelete(null)}>No, keep it</Button>
            <Button kind="danger" onClick={() => remove(askingToDelete.column.id)}>
              Yes, remove it
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button onClick={onClose}>Cancel (no changes)</Button>
        <Button
          kind="primary"
          onClick={() => {
            onSave(draft.filter((column) => column.name.trim() !== ''))
            onClose()
          }}
        >
          Save the columns
        </Button>
      </div>
    </Modal>
  )
}

/** A small square button used for the move and remove actions. */
function SmallButton({
  children,
  onClick,
  disabled,
  title,
  danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`h-11 w-11 rounded-lg border text-lg font-bold disabled:opacity-30 ${
        danger ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-slate-300 text-ink-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}
