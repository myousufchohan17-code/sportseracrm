import { useEffect, useState } from 'react'
import { Package, Search } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../context'
import { EmptyState, Field, Modal, Spinner, StatusBadge, inputClass } from '../components/ui'
import { formatDateTime } from '../utils'
import { Header } from './Customers'

export function Inventory() {
  const { toast } = useApp()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [data, setData] = useState({ items: [], history: [] })
  const [loading, setLoading] = useState(true)
  const [adjust, setAdjust] = useState(null)
  const [delta, setDelta] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await api(`/inventory?search=${encodeURIComponent(search)}&status=${status}`)) }
    catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [search, status])

  return (
    <div className="space-y-5">
      <Header title="Inventory" subtitle="Stock levels stay in sync with products and orders" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card overflow-hidden xl:col-span-2 min-w-0">
          <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-line">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inventory" className={`${inputClass} pl-9`} />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass + ' md:w-40'}>
              <option value="">All</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>
          {loading ? <Spinner /> : data.items.length === 0 ? (
            <EmptyState icon={Package} title="No inventory yet" description="Add products to start tracking stock, low-stock alerts, and history." />
          ) : (
            <>
              <div className="md:hidden divide-y divide-line">
                {data.items.map((p) => (
                  <div key={p.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold min-w-0">{p.name}</p>
                      <StatusBadge status={p.stock_status} />
                    </div>
                    <p className="text-sm text-muted mt-1">Stock {p.stock} · threshold {p.low_stock_threshold}</p>
                    <button onClick={() => { setAdjust(p); setDelta(1); setNote('') }} className="mt-2 text-xs font-semibold text-bloom">Adjust</button>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto table-scroll">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted bg-canvas/70">
                    <tr>
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-left px-4 py-3">Stock</th>
                      <th className="text-left px-4 py-3">Threshold</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((p) => (
                      <tr key={p.id} className="border-t border-line">
                        <td className="px-4 py-3 font-semibold">{p.name}</td>
                        <td className="px-4 py-3">{p.stock}</td>
                        <td className="px-4 py-3">{p.low_stock_threshold}</td>
                        <td className="px-4 py-3"><StatusBadge status={p.stock_status} /></td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setAdjust(p); setDelta(1); setNote('') }} className="text-xs font-semibold text-bloom">Adjust</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-line font-semibold">Inventory history</div>
          {data.history.length === 0 ? (
            <p className="p-6 text-sm text-muted">No stock movements recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line max-h-[520px] overflow-y-auto">
              {data.history.map((m) => (
                <li key={m.id} className="px-5 py-3 text-sm">
                  <p className="font-medium">{m.product_name}</p>
                  <p className={m.delta > 0 ? 'text-emerald-600' : 'text-rose-500'}>{m.delta > 0 ? '+' : ''}{m.delta} · {m.reason.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-muted">{formatDateTime(m.created_at)} {m.staff_name ? `· ${m.staff_name}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Modal open={!!adjust} title={`Adjust ${adjust?.name || ''}`} onClose={() => setAdjust(null)}>
        <form onSubmit={async (e) => {
          e.preventDefault(); setBusy(true)
          try {
            await api(`/inventory/${adjust.id}/adjust`, { method: 'POST', body: { delta: Number(delta), note } })
            toast('Stock updated'); setAdjust(null); load()
          } catch (err) { toast(err.message, 'error') }
          finally { setBusy(false) }
        }} className="space-y-3">
          <p className="text-sm text-muted">Current stock: {adjust?.stock}</p>
          <Field label="Quantity change (use negative to decrease)">
            <input type="number" required className={inputClass} value={delta} onChange={(e) => setDelta(e.target.value)} />
          </Field>
          <Field label="Note"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="form-actions">
            <button type="button" onClick={() => setAdjust(null)} className="h-10 px-4 rounded-xl border">Cancel</button>
            <button disabled={busy} className="h-10 px-4 rounded-xl bg-bloom text-white font-semibold">{busy ? 'Saving…' : 'Save adjustment'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
