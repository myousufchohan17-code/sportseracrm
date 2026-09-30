import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Eye } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../context'
import { useDebounced } from '../hooks'
import { ConfirmDialog, EmptyState, Field, Modal, Pagination, Spinner, StatusBadge, inputClass } from '../components/ui'
import { formatDate, money } from '../utils'

const blank = { name: '', phone: '', email: '', address: '', city: '', notes: '' }

export function Customers() {
  const { settings, toast } = useApp()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const q = useDebounced(search)

  const load = async () => {
    setLoading(true)
    try {
      setData(await api(`/customers?search=${encodeURIComponent(q)}&page=${page}&limit=10`))
    } catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [q, page])

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (editing) await api(`/customers/${editing.id}`, { method: 'PUT', body: form })
      else await api('/customers', { method: 'POST', body: form })
      toast(editing ? 'Customer updated' : 'Customer added')
      setOpen(false)
      load()
    } catch (err) { toast(err.message, 'error') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <Header title="Customers" subtitle="People who order from your shop" onAdd={() => { setEditing(null); setForm(blank); setOpen(true) }} addLabel="Add Customer" />
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-line">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search name, phone, or email" className={`${inputClass} pl-9`} />
          </div>
        </div>
        {loading ? <Spinner /> : data.items.length === 0 ? (
          <EmptyState title="No customers yet" description="Add a customer to start building order history." actionLabel="Add Customer" onAction={() => { setEditing(null); setForm(blank); setOpen(true) }} />
        ) : (
          <>
            <div className="md:hidden divide-y divide-line">
              {data.items.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link className="font-semibold hover:text-bloom min-w-0 truncate" to={`/customers/${c.id}`}>{c.name}</Link>
                    <span className="text-sm font-semibold shrink-0">{money(c.spent, settings.currency_symbol)}</span>
                  </div>
                  <p className="text-sm text-muted mt-1 break-all">{c.phone || c.email || 'No contact'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted">{c.order_count} orders</span>
                    <div className="flex">
                      <Link to={`/customers/${c.id}`} className="inline-flex p-2 rounded-xl hover:bg-canvas"><Eye size={16} /></Link>
                      <button onClick={() => { setEditing(c); setForm(c); setOpen(true) }} className="p-2 rounded-xl hover:bg-canvas"><Pencil size={16} /></button>
                      <button onClick={() => setConfirm(c)} className="p-2 rounded-xl hover:bg-canvas text-rose-500"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto table-scroll">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted bg-canvas/70">
                  <tr>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Phone</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Orders</th>
                    <th className="text-left px-4 py-3">Spent</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-4 py-3 font-semibold"><Link className="hover:text-bloom" to={`/customers/${c.id}`}>{c.name}</Link></td>
                      <td className="px-4 py-3">{c.phone || '—'}</td>
                      <td className="px-4 py-3">{c.email || '—'}</td>
                      <td className="px-4 py-3">{c.order_count}</td>
                      <td className="px-4 py-3">{money(c.spent, settings.currency_symbol)}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Link to={`/customers/${c.id}`} className="inline-flex p-2 rounded-xl hover:bg-canvas"><Eye size={16} /></Link>
                        <button onClick={() => { setEditing(c); setForm(c); setOpen(true) }} className="p-2 rounded-xl hover:bg-canvas"><Pencil size={16} /></button>
                        <button onClick={() => setConfirm(c)} className="p-2 rounded-xl hover:bg-canvas text-rose-500"><Trash2 size={16} /></button>
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
      <CustomerForm open={open} form={form} setForm={setForm} editing={editing} busy={busy} onClose={() => setOpen(false)} onSubmit={save} />
      <ConfirmDialog open={!!confirm} title="Delete customer?" message="Customers with orders cannot be deleted." busy={busy} onClose={() => setConfirm(null)} onConfirm={async () => {
        setBusy(true)
        try { await api(`/customers/${confirm.id}`, { method: 'DELETE' }); toast('Customer deleted'); setConfirm(null); load() }
        catch (err) { toast(err.message, 'error') }
        finally { setBusy(false) }
      }} />
    </div>
  )
}

export function CustomerDetail() {
  const { id } = useParams()
  const { settings, toast } = useApp()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api(`/customers/${id}`).then(setCustomer).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false))
  }, [id])
  if (loading) return <Spinner />
  if (!customer) return <EmptyState title="Customer not found" actionLabel="Back" onAction={() => navigate('/customers')} />
  return (
    <div className="space-y-5">
      <Header title={customer.name} subtitle={customer.phone || customer.email || 'Customer profile'} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-4 sm:p-5 space-y-2 text-sm min-w-0 break-words">
          <p><span className="text-muted">Phone:</span> {customer.phone || '—'}</p>
          <p><span className="text-muted">Email:</span> {customer.email || '—'}</p>
          <p><span className="text-muted">Address:</span> {customer.address || '—'}</p>
          <p><span className="text-muted">City:</span> {customer.city || '—'}</p>
          <p><span className="text-muted">Notes:</span> {customer.notes || '—'}</p>
        </div>
        <div className="card overflow-hidden xl:col-span-2">
          <div className="px-5 py-4 border-b border-line font-semibold">Order history</div>
          {(customer.orders || []).length === 0 ? (
            <EmptyState title="No orders yet" description="This customer has not placed any orders." actionLabel="Create Order" onAction={() => navigate('/orders/new')} />
          ) : (
            <>
              <div className="md:hidden divide-y divide-line">
                {customer.orders.map((o) => (
                  <button key={o.id} type="button" onClick={() => navigate(`/orders/${o.id}`)} className="w-full text-left px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{o.order_number}</p>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="font-semibold">{money(o.total, settings.currency_symbol)}</span>
                      <span className="text-muted text-xs">{formatDate(o.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto table-scroll">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted bg-canvas/70">
                    <tr>
                      <th className="text-left px-4 py-3">Order</th>
                      <th className="text-left px-4 py-3">Total</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map((o) => (
                      <tr key={o.id} className="border-t border-line cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                        <td className="px-4 py-3 font-semibold">{o.order_number}</td>
                        <td className="px-4 py-3">{money(o.total, settings.currency_symbol)}</td>
                        <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                        <td className="px-4 py-3 text-muted">{formatDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function Header({ title, subtitle, onAdd, addLabel }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold break-words">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {onAdd && (
        <button onClick={onAdd} className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-2xl bg-bloom text-white text-sm font-semibold w-full sm:w-auto shrink-0">
          <Plus size={16} /> {addLabel}
        </button>
      )}
    </div>
  )
}

export function CustomerForm({ open, form, setForm, editing, busy, onClose, onSubmit }) {
  return (
    <Modal open={open} title={editing ? 'Edit customer' : 'Add customer'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Name"><input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputClass} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className={inputClass} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        </div>
        <Field label="Address"><input className={inputClass} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="City"><input className={inputClass} value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
        <Field label="Notes"><textarea className={inputClass} rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="form-actions">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-[#3A3A3A] hover:bg-[#1A1A1A] text-white transition-colors">Cancel</button>
          <button disabled={busy} className="h-10 px-4 rounded-xl bg-bloom text-white font-semibold">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
