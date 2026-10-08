/**
 * components/ListsScreen.tsx
 * -------------------------
 * The saved lists - trucks, drivers, descriptions and anything else you want in
 * a drop-down. They are shared by every document and are saved in the same folder.
 *
 * This screen also holds the "links": for example, that choosing truck T715EQQ
 * should fill in the driver RAMADHAN HASSAN MJATA. A list item can hold as many
 * extra words as you like, and any column can be told to copy one of them.
 */

import { useState } from 'react'
import { SUGGESTED_LIST_NAMES } from '../constants'
import type { ListsFile, SavedList } from '../types'
import { findSimilarWord, isSameWord } from '../utils/normalize'
import { Button, Card, SectionTitle, TextField } from './ui'

export function ListsScreen({
  lists,
  onSaveLists,
  onBack,
}: {
  lists: ListsFile
  onSaveLists: (lists: ListsFile) => void
  onBack: () => void
}) {
  const [newListName, setNewListName] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')
  const [editingItem, setEditingItem] = useState<{ listName: string; index: number } | null>(null)
  const [askingToDelete, setAskingToDelete] = useState<{ listName: string; index: number } | null>(null)

  const save = (next: SavedList[]) => onSaveLists({ ...lists, lists: next })

  const updateList = (listName: string, change: (list: SavedList) => SavedList) => {
    save(lists.lists.map((list) => (list.name === listName ? change(list) : list)))
  }

  const addList = () => {
    const name = newListName.trim()
    if (name === '') return
    if (lists.lists.some((list) => list.name.toLowerCase() === name.toLowerCase())) {
      setNewListName('')
      return
    }
    save([...lists.lists, { name, items: [] }])
    setNewListName('')
  }

  const removeList = (listName: string) => {
    save(lists.lists.filter((list) => list.name !== listName))
  }

  const addItem = (listName: string) => {
    const value = newItem.trim()
    setNewItem('')
    setAddingTo(null)
    if (value === '') return
    updateList(listName, (list) => {
      if (list.items.some((item) => isSameWord(item.value, value))) return list
      return { ...list, items: [...list.items, { value, linked: {} }] }
    })
  }

  const removeItem = (listName: string, index: number) => {
    updateList(listName, (list) => ({ ...list, items: list.items.filter((_, i) => i !== index) }))
    setAskingToDelete(null)
  }

  const setItemValue = (listName: string, index: number, value: string) => {
    updateList(listName, (list) => ({
      ...list,
      items: list.items.map((item, i) => (i === index ? { ...item, value } : item)),
    }))
  }

  /** Adds or changes one of the extra words saved with a list item. */
  const setLinkedValue = (listName: string, index: number, key: string, value: string) => {
    updateList(listName, (list) => ({
      ...list,
      items: list.items.map((item, i) => {
        if (i !== index) return item
        const linked = { ...item.linked }
        if (value.trim() === '') delete linked[key]
        else linked[key] = value
        return { ...item, linked }
      }),
    }))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink-900">Manage lists</h1>
          <p className="mt-1 text-sm text-ink-500">
            These are the words you can choose from in drop-downs. They are shared by every document and saved
            in your folder.
          </p>
        </div>
        <Button onClick={onBack}>← Back to my documents</Button>
      </div>

      {/* Add a new list */}
      <Card className="mb-4 p-4">
        <p className="mb-2 text-sm font-bold">Add a new list</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-64">
            <TextField
              value={newListName}
              onChange={setNewListName}
              placeholder="For example: Trucks"
            />
          </div>
          <Button kind="primary" onClick={addList} disabled={newListName.trim() === ''}>
            Add the list
          </Button>
          <span className="text-xs text-ink-500">
            Ideas: {SUGGESTED_LIST_NAMES.filter((name) => !lists.lists.some((list) => list.name === name)).join(', ')}
          </span>
        </div>
      </Card>

      <div className="space-y-4">
        {lists.lists.map((list) => {
          const keys = new Set<string>()
          for (const item of list.items) {
            for (const key of Object.keys(item.linked)) keys.add(key)
          }
          const keyList = Array.from(keys)

          return (
            <Card key={list.name} className="p-4">
              <SectionTitle hint={`${list.items.length} saved word${list.items.length === 1 ? '' : 's'}`}>
                {list.name}
              </SectionTitle>

              <div className="space-y-2">
                {list.items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-ink-500">
                    Nothing in this list yet. Add the first word below.
                  </p>
                ) : null}

                {list.items.map((item, index) => {
                  const isEditing = editingItem?.listName === list.name && editingItem.index === index
                  const suggestion = findSimilarWord(
                    item.value,
                    list.items.filter((_, i) => i !== index).map((other) => other.value),
                  )
                  return (
                    <div
                      key={`${item.value}-${index}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-64">
                          {isEditing ? (
                            <TextField
                              value={item.value}
                              onChange={(value) => setItemValue(list.name, index, value)}
                              autoFocus
                            />
                          ) : (
                            <span className="block truncate rounded-lg border border-transparent bg-white px-3 py-2 text-base font-semibold">
                              {item.value}
                            </span>
                          )}
                        </div>
                        <SmallAction onClick={() => setEditingItem({ listName: list.name, index })} title="Rename">
                          Rename
                        </SmallAction>
                        <SmallAction
                          onClick={() => setAskingToDelete({ listName: list.name, index })}
                          title="Delete"
                          danger
                        >
                          Delete
                        </SmallAction>
                        {suggestion ? (
                          <span className="text-xs text-amber-800">
                            Looks similar to “{suggestion}” - check this is not a duplicate.
                          </span>
                        ) : null}
                      </div>

                      {keyList.length > 0 || isEditing ? (
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {keyList.map((key) => (
                            <label key={key} className="block">
                              <span className="mb-1 block text-xs font-bold text-ink-500 uppercase">{key}</span>
                              <TextField
                                value={item.linked[key] ?? ''}
                                placeholder="Not filled in"
                                onChange={(value) => setLinkedValue(list.name, index, key, value)}
                              />
                            </label>
                          ))}
                        </div>
                      ) : null}

                      {askingToDelete?.listName === list.name && askingToDelete.index === index ? (
                        <div className="mt-2 rounded-lg border-2 border-red-300 bg-red-50 p-2.5">
                          <p className="text-sm font-bold text-red-900">
                            Delete “{item.value}” from the {list.name} list?
                          </p>
                          <p className="mt-0.5 text-sm text-red-900">
                            Documents that already use this word keep it. It will simply not be offered in the
                            drop-down any more.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button onClick={() => setAskingToDelete(null)}>No, keep it</Button>
                            <Button kind="danger" onClick={() => removeItem(list.name, index)}>
                              Yes, delete it
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {addingTo === list.name ? (
                  <>
                    <div className="w-64">
                      <TextField
                        value={newItem}
                        onChange={setNewItem}
                        placeholder="Type a new word"
                        autoFocus
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            addItem(list.name)
                          }
                        }}
                      />
                    </div>
                    <Button kind="primary" onClick={() => addItem(list.name)}>
                      Add it
                    </Button>
                    <Button onClick={() => { setAddingTo(null); setNewItem('') }}>Cancel</Button>
                  </>
                ) : (
                  <Button onClick={() => setAddingTo(list.name)}>+ Add a word</Button>
                )}

                <Button kind="danger" onClick={() => removeList(list.name)} title="Delete this whole list">
                  Delete the whole list
                </Button>
              </div>

              {keyList.length > 0 ? (
                <p className="mt-2 text-xs text-ink-500">
                  The extra words above ({keyList.join(', ')}) can be filled in automatically by any column - see
                  “Design columns” in a document.
                </p>
              ) : null}
            </Card>
          )
        })}
      </div>

      <Card className="mt-4 p-4">
        <p className="text-sm text-ink-500">
          Tip: a truck written as “T537 EBR”, “T537EBR” or “t537ebr” is understood as the same truck, so
          capitals and spaces do not matter. If you type something close to a word that is already saved, a
          gentle “Did you mean ...?” appears so you do not save it twice.
        </p>
      </Card>
    </div>
  )
}

function SmallAction({
  children,
  onClick,
  title,
  danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
        danger
          ? 'border-red-300 text-red-700 hover:bg-red-50'
          : 'border-slate-300 text-ink-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}
