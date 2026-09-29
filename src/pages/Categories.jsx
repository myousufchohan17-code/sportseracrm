import { useEffect, useState } from 'react'
import { Pencil, Search, Tags, Trash2 } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../context'
import { ConfirmDialog, EmptyState, Field, Modal, Spinner, inputClass } from '../components/ui'
import { Header } from './Customers'

export function Categories() {
  const { toast } = useApp()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)

  const load = async () => {
    setLoading(true)
    try { setItems((await api(`/categories?search=${encodeURIComponent(search)}`)).items) }
    catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [search])

  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      if (editing) await api(`/categories/${editing.id}`, { method: 'PUT', body: form })
      else await api('/categories', { method: 'POST', body: form })
      toast(editing ? 'Category updated' : 'Category added')
      setOpen(false); load()
    } catch (err) { toast(err.message, 'error') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <Header title="Categories" subtitle="Group products by type" onAdd={() => { setEditing(null); setForm({ name: '', description: '' }); setOpen(true) }} addLabel="Add Category" />
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-line">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories" className={`${inputClass} pl-9`} />
          </div>
        </div>
        {loading ? <Spinner /> : items.length === 0 ? (
          <EmptyState icon={Tags} title="No categories yet" description="Create categories such as Bouquets or Plants when you are ready. None are preloaded." actionLabel="Add Category" onAction={() => setOpen(true)} />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((c) => (
              <li key={c.id} className="px-4 sm:px-5 py-4 flex items-start sm:items-center gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <button className="font-semibold hover:text-bloom text-left truncate max-w-full" onClick={async () => setDetail(await api(`/categories/${c.id}`))}>{c.name}</button>
                  <p className="text-xs text-muted break-words">{c.product_count} products · {c.description || 'No description'}</p>
                </div>
                <button onClick={() => { setEditing(c); setForm({ name: c.name, description: c.description || '' }); setOpen(true) }} className="p-2 rounded-xl hover:bg-canvas shrink-0"><Pencil size={16} /></button>
                <button onClick={() => setConfirm(c)} className="p-2 rounded-xl hover:bg-canvas text-rose-500 shrink-0"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal open={open} title={editing ? 'Edit category' : 'Add category'} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <Field label="Name"><input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><textarea className={inputClass} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="form-actions">
            <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 rounded-xl border">Cancel</button>
            <button disabled={busy} className="h-10 px-4 rounded-xl bg-bloom text-white font-semibold">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>
      <Modal open={!!detail} title={detail?.name || 'Category'} onClose={() => setDetail(null)}>
        {(detail?.products || []).length === 0 ? <p className="text-sm text-muted">No products in this category.</p> : (
          <ul className="space-y-2 text-sm">{detail.products.map((p) => <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="text-muted">stock {p.stock}</span></li>)}</ul>
        )}
      </Modal>
      <ConfirmDialog open={!!confirm} title="Delete category?" message="Products in this category will be unassigned." busy={busy} onClose={() => setConfirm(null)} onConfirm={async () => {
        setBusy(true)
        try { await api(`/categories/${confirm.id}`, { method: 'DELETE' }); toast('Category deleted'); setConfirm(null); load() }
        catch (err) { toast(err.message, 'error') }
        finally { setBusy(false) }
      }} />
    </div>
  )
}
