import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Pencil, Printer } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../context'
import { useDebounced } from '../hooks'
import { ConfirmDialog, EmptyState, Pagination, Spinner, StatusBadge, inputClass, Modal } from '../components/ui'
import { ReceiptActions, ReceiptDocument, printReceipt } from '../components/Receipt'
import { ORDER_STATUSES, formatDate, money } from '../utils'

export function Orders() {
  const { settings, toast } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('created_at')
  const [dir, setDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const q = useDebounced(search)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`/orders?search=${encodeURIComponent(q)}&status=${status}&sort=${sort}&dir=${dir}&page=${page}&limit=10`)
      setData(res)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [q, status, sort, dir, page])

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted">Create, track, and update sports shop orders</p>
        </div>
        <button onClick={() => navigate('/orders/new')} className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-2xl bg-bloom text-white text-sm font-semibold w-full sm:w-auto">
          <Plus size={16} /> Create Order
        </button>
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-line">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search order number or customer" className={`${inputClass} pl-9`} />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={inputClass + ' md:w-48'}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={`${sort}:${dir}`} onChange={(e) => { const [s, d] = e.target.value.split(':'); setSort(s); setDir(d) }} className={inputClass + ' md:w-48'}>
            <option value="created_at:desc">Newest</option>
            <option value="created_at:asc">Oldest</option>
            <option value="total:desc">Highest total</option>
            <option value="total:asc">Lowest total</option>
          </select>
        </div>
        {loading ? <Spinner /> : data.items.length === 0 ? (
          <EmptyState icon={Plus} title="No orders yet" description="Create your first order to start tracking sales, inventory, and deliveries." actionLabel="Create Order" onAction={() => navigate('/orders/new')} />
        ) : (
          <>
            <div className="md:hidden divide-y divide-line">
              {data.items.map((o) => (
                <div key={o.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/orders/${o.id}`} className="font-semibold text-sm hover:text-bloom">{o.order_number}</Link>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="text-sm text-muted mt-1">{o.customer?.name || o.customer_name || 'Walk-in'}</p>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="font-semibold">{money(o.total, settings.currency_symbol)}</span>
                    <span className="text-muted text-xs">{formatDate(o.created_at)}</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    <Link to={`/orders/${o.id}`} className="p-2 rounded-xl hover:bg-canvas" title="View"><Eye size={16} /></Link>
                    <button type="button" className="p-2 rounded-xl hover:bg-canvas" title="Receipt" onClick={() => setReceipt(o)}>
                      <Printer size={16} />
                    </button>
                    {o.status !== 'cancelled' && (
                      <Link to={`/orders/${o.id}/edit`} className="p-2 rounded-xl hover:bg-canvas" title="Edit"><Pencil size={16} /></Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto table-scroll">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted bg-canvas/70">
                  <tr>
                    <th className="text-left px-4 py-3">Order</th>
                    <th className="text-left px-4 py-3">Customer</th>
                    <th className="text-left px-4 py-3">Items</th>
                    <th className="text-left px-4 py-3">Total</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id} className="border-t border-line">
                      <td className="px-4 py-3 font-semibold"><Link to={`/orders/${o.id}`} className="hover:text-bloom">{o.order_number}</Link></td>
                      <td className="px-4 py-3">{o.customer?.name || o.customer_name || 'Walk-in'}</td>
                      <td className="px-4 py-3 text-muted">{o.items?.length || 0}</td>
                      <td className="px-4 py-3">{money(o.total, settings.currency_symbol)}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-muted">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link to={`/orders/${o.id}`} className="p-2 rounded-xl hover:bg-canvas" title="View"><Eye size={16} /></Link>
                          <button type="button" className="p-2 rounded-xl hover:bg-canvas" title="Receipt" onClick={() => setReceipt(o)}>
                            <Printer size={16} />
                          </button>
                          {o.status !== 'cancelled' && (
                            <Link to={`/orders/${o.id}/edit`} className="p-2 rounded-xl hover:bg-canvas" title="Edit"><Pencil size={16} /></Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Pagination page={data.page || page} pages={data.pages} total={data.total} onPage={setPage} />
      </div>
      <Modal open={!!receipt} title={`Receipt ${receipt?.order_number || ''}`} onClose={() => setReceipt(null)} slim>
        {receipt && <ReceiptDocument order={receipt} settings={settings} />}
        <ReceiptActions
          onClose={() => setReceipt(null)}
          onPrint={() => {
            const ok = printReceipt(receipt, settings)
            if (!ok) toast('Allow pop-ups to print the receipt', 'error')
          }}
        />
      </Modal>
      <ConfirmDialog open={!!confirm} title="Delete order?" message="This cannot be undone." busy={busy} onClose={() => setConfirm(null)} onConfirm={async () => {
        setBusy(true)
        try {
          await api(`/orders/${confirm.id}`, { method: 'DELETE' })
          toast('Order deleted')
          setConfirm(null)
          load()
        } catch (err) { toast(err.message, 'error') }
        finally { setBusy(false) }
      }} />
    </div>
  )
}
