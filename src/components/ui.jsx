import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function Modal({ open, title, children, onClose, wide, slim }) {
  if (!open) return null
  const width = slim ? 'max-w-[360px]' : wide ? 'max-w-3xl' : 'max-w-lg'
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Close dialog" />
      <div className={`relative z-10 w-full ${width} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-line pb-[env(safe-area-inset-bottom)]`}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-line sticky top-0 bg-white">
          <h3 className="text-base sm:text-lg font-semibold text-ink min-w-0 truncate">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', danger = true, busy, onConfirm, onClose }) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-muted leading-6">{message}</p>
      <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3">
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-line text-sm font-medium w-full sm:w-auto">Cancel</button>
        <button
          disabled={busy}
          onClick={onConfirm}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 w-full sm:w-auto ${danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-bloom hover:bg-bloom-dark'}`}
        >
          {busy ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 sm:py-14 px-4 sm:px-6">
      <div className="w-14 h-14 rounded-2xl bg-blush text-bloom flex items-center justify-center mb-4">
        {Icon ? <Icon size={26} /> : null}
      </div>
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>
      {actionLabel && onAction ? (
        <button onClick={onAction} className="mt-5 px-4 py-2.5 rounded-xl bg-bloom text-white text-sm font-semibold hover:bg-bloom-dark w-full max-w-xs sm:w-auto">
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted text-sm">
      <span className="w-5 h-5 rounded-full border-2 border-blush border-t-bloom animate-spin" />
      {label}
    </div>
  )
}

export function Pagination({ page, pages, total, onPage }) {
  if (!total) return null
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-5 py-3 border-t border-line text-sm text-muted">
      <span>{total} record{total === 1 ? '' : 's'}</span>
      <div className="flex items-center justify-between sm:justify-end gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-3 py-1.5 rounded-lg border border-line disabled:opacity-40">Prev</button>
        <span className="whitespace-nowrap">Page {page} of {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="px-3 py-1.5 rounded-lg border border-line disabled:opacity-40">Next</button>
      </div>
    </div>
  )
}

export function Field({ label, children, error }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted mb-1.5">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-500 mt-1 block">{error}</span> : null}
    </label>
  )
}

export const inputClass =
  'w-full min-w-0 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink soft-ring placeholder:text-muted/70'

export function StatusBadge({ status }) {
  const map = {
    pending: 'bg-peach-soft text-peach',
    confirmed: 'bg-lavender-soft text-lavender',
    in_process: 'bg-sky-50 text-sky-600',
    ready: 'bg-mint-soft text-emerald-600',
    out_for_delivery: 'bg-orange-50 text-orange-600',
    delivered: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-slate-100 text-slate-500',
    scheduled: 'bg-peach-soft text-peach',
    assigned: 'bg-lavender-soft text-lavender',
    failed: 'bg-rose-50 text-rose-600',
    active: 'bg-mint-soft text-emerald-700',
    draft: 'bg-slate-100 text-slate-500',
    paused: 'bg-peach-soft text-orange-600',
    ended: 'bg-slate-100 text-slate-500',
    in: 'bg-mint-soft text-emerald-700',
    low: 'bg-peach-soft text-orange-600',
    out: 'bg-rose-50 text-rose-600',
  }
  const label = String(status || '').replaceAll('_', ' ')
  return (
    <span className={`inline-flex capitalize px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {label}
    </span>
  )
}
