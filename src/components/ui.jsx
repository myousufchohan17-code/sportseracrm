import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function Modal({ open, title, children, onClose, wide, slim }) {
  if (!open) return null
  const width = slim ? 'max-w-[380px]' : wide ? 'max-w-3xl' : 'max-w-lg'
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button className="absolute inset-0 bg-black/75 backdrop-blur-[3px]" onClick={onClose} aria-label="Close dialog" />
      <div className={`relative z-10 w-full ${width} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#262626] shadow-2xl border border-[#3A3A3A] text-white pb-[env(safe-area-inset-bottom)]`}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-[#3A3A3A] sticky top-0 bg-[#262626] z-10">
          <h3 className="text-base sm:text-lg font-semibold text-white min-w-0 truncate">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#1A1A1A] text-[#A3A3A3] hover:text-white shrink-0 transition-colors" aria-label="Close">
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
      <p className="text-sm text-[#A3A3A3] leading-6">{message}</p>
      <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3">
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#3A3A3A] hover:bg-[#1A1A1A] text-white text-sm font-medium transition-colors w-full sm:w-auto">
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={onConfirm}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-colors w-full sm:w-auto ${
            danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#F97316] hover:bg-[#EA580C]'
          }`}
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
      <div className="w-14 h-14 rounded-2xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center mb-4">
        {Icon ? <Icon size={26} /> : null}
      </div>
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="text-sm text-[#A3A3A3] mt-1 max-w-sm">{description}</p>
      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="mt-5 px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold transition-colors w-full max-w-xs sm:w-auto"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-[#A3A3A3] text-sm">
      <span className="w-5 h-5 rounded-full border-2 border-[#3A3A3A] border-t-[#F97316] animate-spin" />
      {label}
    </div>
  )
}

export function Pagination({ page, pages, total, onPage }) {
  if (!total) return null
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-5 py-3 border-t border-[#3A3A3A] text-sm text-[#A3A3A3]">
      <span>{total} record{total === 1 ? '' : 's'}</span>
      <div className="flex items-center justify-between sm:justify-end gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-[#3A3A3A] hover:bg-[#1A1A1A] text-white disabled:opacity-40 transition-colors"
        >
          Prev
        </button>
        <span className="whitespace-nowrap">Page {page} of {pages}</span>
        <button
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-[#3A3A3A] hover:bg-[#1A1A1A] text-white disabled:opacity-40 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export function Field({ label, children, error }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-400 mt-1 block">{error}</span> : null}
    </label>
  )
}

export const inputClass =
  'w-full min-w-0 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] px-3.5 py-2.5 text-sm text-white soft-ring placeholder:text-[#A3A3A3]/60 focus:border-[#F97316]'

export function StatusBadge({ status }) {
  const map = {
    pending: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    confirmed: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    in_process: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    ready: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    out_for_delivery: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    delivered: 'bg-green-500/15 text-green-400 border border-green-500/30',
    cancelled: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
    scheduled: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    assigned: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    failed: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    active: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    draft: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
    paused: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    ended: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
    in: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    low: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    out: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    inactive: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
  }
  const label = String(status || '').replaceAll('_', ' ')
  return (
    <span className={`inline-flex capitalize px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 ${map[status] || 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
      {label}
    </span>
  )
}
