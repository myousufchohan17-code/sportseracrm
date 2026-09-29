import { useEffect, useState } from 'react'
import { Flower2, Pencil, Search, Trash2 } from 'lucide-react'
import { api, upload } from '../api'
import { useApp } from '../context'
import { useDebounced } from '../hooks'
import { ConfirmDialog, EmptyState, Field, Modal, Pagination, Spinner, StatusBadge, inputClass } from '../components/ui'
import { money } from '../utils'
import { Header } from './Customers'

const blank = { name: '', description: '', category_id: '', price: '', cost: '', stock: 0, low_stock_threshold: 5, image: '', active: true }

export function Products() {
  const { settings, toast } = useApp()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pages: 1 })
  const [categories, setCategories] = useState([])
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
      setData(await api(`/products?search=${encodeURIComponent(q)}&status=${status}&category=${category}&page=${page}&limit=10`))
    } catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [q, status, category, page])
  useEffect(() => {
    api('/categories').then((d) => setCategories(d.items || [])).catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = { ...form, price: Number(form.price) || 0, cost: Number(form.cost) || 0, stock: Number(form.stock) || 0, low_stock_threshold: Number(form.low_stock_threshold) || 0, active: Boolean(form.active) }
      if (editing) await api(`/products/${editing.id}`, { method: 'PUT', body: payload })
      else await api('/products', { method: 'POST', body: payload })
      toast(editing ? 'Product updated' : 'Product added')
      setOpen(false)
      load()
    } catch (err) { toast(err.message, 'error') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <Header title="Products" subtitle="Bouquets, stems, and gifts in your catalog" onAdd={() => { setEditing(null); setForm(blank); setOpen(true) }} addLabel="Add Product" />
      <div className="card overflow-hidden">
        <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-line">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search products" className={`${inputClass} pl-9`} />
          </div>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className={inputClass + ' md:w-44'}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={inputClass + ' md:w-40'}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
        {loading ? <Spinner /> : data.items.length === 0 ? (
          <EmptyState icon={Flower2} title="No products yet" description="Add your first sports product. Nothing is shown until you create it." actionLabel="Add Product" onAction={() => { setEditing(null); setForm(blank); setOpen(true) }} />
        ) : (
          <>
            <div className="md:hidden divide-y divide-line">
              {data.items.map((p) => (
                <div key={p.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {p.image ? <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" /> : <div className="w-12 h-12 rounded-xl bg-blush text-bloom grid place-items-center shrink-0"><Flower2 size={16} /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted">{p.category?.name || 'Uncategorized'} · stock {p.stock}</p>
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <span className="text-sm font-semibold">{money(p.price, settings.currency_symbol)}</span>
                        <StatusBadge status={p.active ? p.stock_status : 'inactive'} />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <button onClick={() => { setEditing(p); setForm({ ...blank, ...p, active: Boolean(p.active) }); setOpen(true) }} className="p-2 rounded-xl hover:bg-canvas"><Pencil size={16} /></button>
                    <button onClick={() => setConfirm(p)} className="p-2 rounded-xl hover:bg-canvas text-rose-500"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto table-scroll">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted bg-canvas/70">
                  <tr>
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-left px-4 py-3">Price</th>
                    <th className="text-left px-4 py-3">Stock</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-xl object-cover" /> : <div className="w-10 h-10 rounded-xl bg-blush text-bloom grid place-items-center"><Flower2 size={16} /></div>}
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-xs text-muted line-clamp-1">{p.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{p.category?.name || '—'}</td>
                      <td className="px-4 py-3">{money(p.price, settings.currency_symbol)}</td>
                      <td className="px-4 py-3">{p.stock}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.active ? p.stock_status : 'inactive'} /></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setEditing(p); setForm({ ...blank, ...p, active: Boolean(p.active) }); setOpen(true) }} className="p-2 rounded-xl hover:bg-canvas"><Pencil size={16} /></button>
                        <button onClick={() => setConfirm(p)} className="p-2 rounded-xl hover:bg-canvas text-rose-500"><Trash2 size={16} /></button>
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
      <Modal open={open} title={editing ? 'Edit product' : 'Add product'} onClose={() => setOpen(false)} wide>
        <form onSubmit={save} className="space-y-3">
          <Field label="Name"><input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><textarea className={inputClass} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Category">
              <select className={inputClass} value={form.category_id || ''} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Price"><input type="number" min="0" step="0.01" className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Cost"><input type="number" min="0" step="0.01" className={inputClass} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
            {!editing && <Field label="Opening stock"><input type="number" min="0" className={inputClass} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>}
            <Field label="Low stock threshold"><input type="number" min="0" className={inputClass} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></Field>
          </div>
          <Field label="Image">
            <input type="file" accept="image/*" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const res = await upload('/upload', file)
                setForm((f) => ({ ...f, image: res.url }))
              } catch (err) { toast(err.message, 'error') }
            }} />
            {form.image && <img src={form.image} alt="" className="mt-2 w-20 h-20 rounded-xl object-cover" />}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
          </label>
          <div className="form-actions">
            <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 rounded-xl border">Cancel</button>
            <button disabled={busy} className="h-10 px-4 rounded-xl bg-bloom text-white font-semibold">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!confirm} title="Delete product?" message="Products used on orders cannot be deleted. Deactivate them instead." busy={busy} onClose={() => setConfirm(null)} onConfirm={async () => {
        setBusy(true)
        try { await api(`/products/${confirm.id}`, { method: 'DELETE' }); toast('Product deleted'); setConfirm(null); load() }
        catch (err) { toast(err.message, 'error') }
        finally { setBusy(false) }
      }} />
    </div>
  )
}
