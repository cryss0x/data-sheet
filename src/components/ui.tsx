/**
 * components/ui.tsx
 * ----------------
 * Small, plain building blocks used by every screen: buttons, boxes, the
 * "are you sure?" window, and so on.
 *
 * They are all big and clearly worded on purpose, because this app is used on a
 * daily basis by someone who should not have to think about how a screen works.
 */

import type { ReactNode } from 'react'
import { useEffect } from 'react'

/* ------------------------------------------------------------------ buttons */

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'quiet'

const BUTTON_STYLES: Record<ButtonKind, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 border border-brand-800 shadow-sm',
  secondary: 'bg-white text-ink-900 hover:bg-slate-100 border border-slate-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 border border-red-700 shadow-sm',
  quiet: 'bg-transparent text-brand-800 hover:bg-brand-50 border border-transparent',
}

export function Button({
  children,
  onClick,
  kind = 'secondary',
  type = 'button',
  disabled = false,
  title,
  full = false,
  big = false,
}: {
  children: ReactNode
  onClick?: () => void
  kind?: ButtonKind
  type?: 'button' | 'submit'
  disabled?: boolean
  title?: string
  full?: boolean
  big?: boolean
}) {
  const size = big ? 'px-6 py-3.5 text-lg' : 'px-4 py-2.5 text-base'
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_STYLES[kind]} ${size} rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        full ? 'w-full' : ''
      }`}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------- boxes */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xl font-bold text-ink-900">{children}</h2>
      {hint ? <p className="mt-1 text-sm text-ink-500">{hint}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------- inputs */

export function TextField({
  value,
  onChange,
  placeholder,
  type = 'text',
  autoFocus = false,
  inputMode,
  className = '',
  onKeyDown,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  autoFocus?: boolean
  inputMode?: 'text' | 'decimal' | 'numeric'
  className?: string
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  ariaLabel?: string
}) {
  return (
    <input
      type={type}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      autoFocus={autoFocus}
      inputMode={inputMode}
      onKeyDown={onKeyDown}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-ink-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200 ${className}`}
    />
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-ink-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
    />
  )
}

/** A drop-down box. */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  ariaLabel?: string
  className?: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-ink-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200 ${className}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

/** A tick box with a clear label next to it. */
export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-slate-400 text-brand-700 accent-brand-700"
      />
      <span>{label}</span>
    </label>
  )
}

/** A round switch, used for the "Group rows" style settings. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 rounded border-slate-400 accent-brand-700"
      />
      <span>
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        {hint ? <span className="block text-xs text-ink-500">{hint}</span> : null}
      </span>
    </label>
  )
}

/* ------------------------------------------------------------------- window */

/** A window that appears on top of the screen. */
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  // Pressing Escape closes the window, like everywhere else in Windows.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8">
      <div
        className={`w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} rounded-2xl bg-white shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-3 py-1 text-2xl leading-none text-ink-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

/** The "Are you sure?" window. Nothing is deleted without one. */
export function ConfirmDialog({
  title,
  message,
  confirmWord = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmWord?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-6 text-base text-ink-700">{message}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button onClick={onCancel}>No, keep it</Button>
        <Button kind="danger" onClick={onConfirm}>
          Yes, {confirmWord.toLowerCase()}
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ notices */

/** The big red box shown when something could not be done. */
export function AlertBox({
  title,
  message,
  onClose,
  children,
}: {
  title: string
  message: string
  onClose?: () => void
  children?: ReactNode
}) {
  return (
    <div className="nudge mb-4 rounded-xl border-2 border-red-300 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">
          ⚠
        </span>
        <div className="flex-1">
          <p className="text-base font-bold text-red-900">{title}</p>
          <p className="mt-1 text-sm text-red-900">{message}</p>
          {children ? <div className="mt-3 flex flex-wrap gap-2">{children}</div> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close this message"
            className="rounded-lg px-2 text-xl leading-none text-red-700 hover:bg-red-100"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** The small blue box used for helpful notes. */
export function NoteBox({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
      {children}
    </div>
  )
}

/** A small label, like the "Saved" mark. */
export function Badge({ children, tone = 'grey' }: { children: ReactNode; tone?: 'grey' | 'green' | 'red' }) {
  const tones = {
    grey: 'bg-slate-100 text-ink-700 border-slate-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    red: 'bg-red-100 text-red-800 border-red-200',
  }
  return (
    <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}
