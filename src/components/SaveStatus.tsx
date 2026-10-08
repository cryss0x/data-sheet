/**
 * components/SaveStatus.tsx
 * -------------------------
 * The small, always-visible mark that says whether the work is safely in its
 * file. It is deliberately simple: "Saving...", "Saved 10:42", or a red warning.
 */

import { APP_NAME, PRIVACY_NOTE } from '../constants'
import type { SaveState, StorageMode } from '../types'
import { formatClock } from '../utils/format'

export function SaveStatus({
  state,
  lastSavedAt,
  mode,
  connected,
}: {
  state: SaveState
  lastSavedAt: string | null
  mode: StorageMode
  connected: boolean
}) {
  const where = mode === 'folder' ? 'in your folder' : 'in this browser'

  const look =
    state === 'saving'
      ? { text: 'Saving…', colour: 'text-amber-700', dot: 'bg-amber-500' }
      : state === 'error'
        ? { text: 'Not saved — see the red message', colour: 'text-red-700', dot: 'bg-red-600' }
        : state === 'saved'
          ? { text: `Saved ✓ ${lastSavedAt ? formatClock(lastSavedAt) : ''}`, colour: 'text-green-700', dot: 'bg-green-600' }
          : { text: 'Ready', colour: 'text-ink-500', dot: 'bg-slate-400' }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className={`inline-flex items-center gap-1.5 font-bold ${look.colour}`} role="status" aria-live="polite">
        <span className={`h-2.5 w-2.5 rounded-full ${look.dot}`} aria-hidden="true" />
        {look.text}
      </span>
      <span className="text-ink-500">
        {mode === 'folder' && !connected
          ? 'Not in your folder yet — it will go up when you reconnect'
          : `Kept ${where}`}
      </span>
      <span className="hidden text-ink-500 sm:inline">
        {APP_NAME} · {PRIVACY_NOTE}
      </span>
    </div>
  )
}
