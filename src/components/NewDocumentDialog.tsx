/**
 * components/NewDocumentDialog.tsx
 * --------------------------------
 * Making a new document takes two steps and nothing else:
 *   1. type the title,
 *   2. choose a "Quick start" example of columns, or start blank.
 *
 * The title is saved the moment it is typed, so closing the window straight
 * afterwards still leaves the document in the list.
 */

import { useState } from 'react'
import { DEFAULT_SETTINGS, TEMPLATES } from '../constants'
import type { Template } from '../constants'
import type { Column, SheetDocument } from '../types'
import { newId } from '../utils/id'
import { safeFileName } from '../utils/format'
import { Button, Modal, TextField } from './ui'

export function NewDocumentDialog({
  existingTitles,
  onCreate,
  onClose,
}: {
  existingTitles: string[]
  onCreate: (document: SheetDocument) => Promise<SheetDocument>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [templateKey, setTemplateKey] = useState<string>('expenses')
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)

  const trimmed = title.trim()
  const template: Template = TEMPLATES.find((item) => item.key === templateKey) ?? TEMPLATES[0]
  const alreadyExists =
    trimmed !== '' && existingTitles.some((item) => item.toLowerCase() === trimmed.toLowerCase())

  const create = async () => {
    if (trimmed === '' || alreadyExists) return
    setSaving(true)
    const now = new Date().toISOString()
    const columns: Column[] = template.columns.map((column) => {
      const made: Column = { id: newId('col'), name: column.name, type: column.type }
      if (column.listName) made.listName = column.listName
      return made
    })

    await onCreate({
      id: newId('doc'),
      title: trimmed,
      subtitle: '',
      createdAt: now,
      updatedAt: now,
      columns,
      rows: [],
      settings: { ...DEFAULT_SETTINGS },
    })
    // The editor screen opens the new document, so nothing else is needed here.
  }

  return (
    <Modal title="New document" onClose={onClose} wide>
      {step === 1 ? (
        <div>
          <label className="mb-1 block text-sm font-bold" htmlFor="new-title">
            What is this document called?
          </label>
          <TextField
            value={title}
            onChange={setTitle}
            autoFocus
            placeholder="For example: TOTAL EXPENSES OF KBL TRUCKS SEPTEMBER"
            ariaLabel="Document title"
          />
          <p className="mt-2 text-sm text-ink-500">
            This name is also used for the file in your folder, and for the PDF you export.
          </p>

          {alreadyExists ? (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              You already have a document with this name. Please choose a different one.
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <Button onClick={onClose}>Cancel</Button>
            <Button kind="primary" big disabled={trimmed === '' || alreadyExists} onClick={() => setStep(2)}>
              Next →
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-ink-700">
            Choose a starting point for your columns. You can change every one of them later, so nothing here
            is fixed.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TEMPLATES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTemplateKey(item.key)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  templateKey === item.key
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="font-bold text-ink-900">{item.label}</p>
                <p className="mt-0.5 text-sm text-ink-500">{item.description}</p>
                {item.columns.length > 0 ? (
                  <p className="mt-2 text-xs text-ink-500">
                    {item.columns.map((column) => column.name).join(' · ')}
                  </p>
                ) : null}
              </button>
            ))}
          </div>

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-700">
            New document: <span className="font-bold">{trimmed}</span>
            <span className="text-ink-500"> — file name: {safeFileName(trimmed)}.json</span>
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button onClick={() => setStep(1)}>← Back</Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button kind="primary" big disabled={saving} onClick={() => void create()}>
              {saving ? 'Creating…' : 'Create the document'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
