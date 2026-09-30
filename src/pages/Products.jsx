import { useEffect, useState } from 'react'
import { Package, Pencil, Search, Trash2, Upload, X, Loader2 } from 'lucide-react'
import { api, upload } from '../api'
import { useApp } from '../context'
import { useDebounced } from '../hooks'
import { ConfirmDialog, EmptyState, Field, Modal, Pagination, Spinner, StatusBadge, inputClass } from '../components/ui'
import { money } from '../utils'
import { Header } from './Customers'

const blank = {
  name: '',
  description: '',
  category_id: '',
  price: '',
  cost: '',
  stock: 0,
  low_stock_threshold: 5,
  image: '',
  active: true,
}

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
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState('')
  const q = useDebounced(search)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`/products?search=${encodeURIComponent(q)}&status=${status}&category=${category}&page=${page}&limit=12`)
      setData(res)
    } catch (err) {
      toast(err.message || 'Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [q, status, category, page])

  useEffect(() => {
    api('/categories').then((d) => setCategories(d.items || [])).catch(() => {})
  }, [])

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast('Only JPG, PNG, and WebP images are allowed', 'error')
      e.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image file size must be less than 5 MB', 'error')
      e.target.value = ''
      return
    }

    // Local preview immediately
    const localUrl = URL.createObjectURL(file)
    setImagePreview(localUrl)
    setUploadingImage(true)

    try {
      const res = await upload('/upload', file, 'image')
      setForm((f) => ({ ...f, image: res.url }))
      setImagePreview(res.url)
      toast('Image uploaded successfully')
    } catch (err) {
      toast(err.message || 'Failed to upload image. Make sure BLOB_READ_WRITE_TOKEN is configured.', 'error')
      setImagePreview(form.image || '')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast('Product name is required', 'error')
      return
    }
    setBusy(true)
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        price: Number(form.price) || 0,
        cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        active: Boolean(form.active),
      }
      if (editing) {
        await api(`/products/${editing.id}`, { method: 'PUT', body: payload })
        toast('Product updated successfully')
      } else {
        await api('/products', { method: 'POST', body: payload })
        toast('Product created successfully')
      }
      setOpen(false)
      load()
    } catch (err) {
      toast(err.message || 'Failed to save product', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      await api(`/products/${confirm.id}`, { method: 'DELETE' })
      toast('Product deleted successfully')
      setConfirm(null)
      load()
    } catch (err) {
      toast(err.message || 'Could not delete product. Please try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const openNewModal = () => {
    setEditing(null)
    setForm(blank)
    setImagePreview('')
    setOpen(true)
  }

  const openEditModal = (p) => {
    setEditing(p)
    setForm({
      ...blank,
      ...p,
      category_id: p.category_id || '',
      active: Boolean(p.active),
    })
    setImagePreview(p.image || '')
    setOpen(true)
  }

  return (
    <div className="space-y-5">
      <Header
        title="Products & Inventory"
        subtitle="Sports gear, equipment, and apparel catalog"
        onAdd={openNewModal}
        addLabel="Add Product"
      />

      <div className="card overflow-hidden">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-[#3A3A3A]">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search products by name or description…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1) }}
            className={`${inputClass} md:w-48`}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className={`${inputClass} md:w-40`}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>

        {loading ? (
          <Spinner label="Loading products…" />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Add your first sports product to start managing inventory and taking orders."
            actionLabel="Add Product"
            onAction={openNewModal}
          />
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden divide-y divide-[#3A3A3A]">
              {data.items.map((p) => (
                <div key={p.id} className="px-4 py-3.5 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-[#1A1A1A] border border-[#3A3A3A] overflow-hidden flex items-center justify-center shrink-0">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={22} className="text-[#A3A3A3]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate">{p.name}</p>
                      <p className="text-xs text-[#A3A3A3] mt-0.5">
                        {p.category?.name || 'Uncategorized'} · Stock: {p.stock}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-sm font-bold text-[#F97316]">
                          {money(p.price, settings.currency_symbol)}
                        </span>
                        <StatusBadge status={p.active ? p.stock_status : 'inactive'} />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1 border-t border-[#3A3A3A]/40">
                    <button
                      onClick={() => openEditModal(p)}
                      className="p-2 rounded-xl bg-[#1A1A1A] hover:bg-[#333] border border-[#3A3A3A] text-white"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setConfirm(p)}
                      className="p-2 rounded-xl bg-[#1A1A1A] hover:bg-rose-500/20 border border-[#3A3A3A] hover:border-rose-500/30 text-rose-400"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto table-scroll">
              <table className="w-full text-sm">
                <thead className="text-xs text-[#A3A3A3] bg-[#1A1A1A]">
                  <tr>
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-left px-4 py-3">Price</th>
                    <th className="text-left px-4 py-3">Stock</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.id} className="border-t border-[#3A3A3A] hover:bg-[#1A1A1A]/40 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-[#1A1A1A] border border-[#3A3A3A] overflow-hidden flex items-center justify-center shrink-0">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={20} className="text-[#A3A3A3]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{p.name}</p>
                            {p.description && (
                              <p className="text-xs text-[#A3A3A3] line-clamp-1 mt-0.5">{p.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-white">{p.category?.name || '—'}</td>
                      <td className="px-4 py-3.5 font-semibold text-[#F97316]">
                        {money(p.price, settings.currency_symbol)}
                      </td>
                      <td className="px-4 py-3.5 text-white font-medium">{p.stock}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={p.active ? p.stock_status : 'inactive'} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-2 rounded-xl hover:bg-[#1A1A1A] border border-transparent hover:border-[#3A3A3A] text-white transition-colors"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setConfirm(p)}
                            className="p-2 rounded-xl hover:bg-[#1A1A1A] border border-transparent hover:border-[#3A3A3A] text-rose-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
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

      {/* Add / Edit Product Modal */}
      <Modal open={open} title={editing ? 'Edit Product' : 'Add New Product'} onClose={() => setOpen(false)} wide>
        <form onSubmit={save} className="space-y-4">
          <Field label="Product Name *">
            <input
              required
              className={inputClass}
              placeholder="e.g. Wilson Tennis Racket Pro"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label="Description">
            <textarea
              className={inputClass}
              rows={2}
              placeholder="Features, size, specs…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Category">
              <select
                className={inputClass}
                value={form.category_id || ''}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Retail Price ($) *">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                className={inputClass}
                placeholder="49.99"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>

            <Field label="Cost Price ($)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                placeholder="25.00"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </Field>

            {!editing && (
              <Field label="Opening Stock Quantity">
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  placeholder="10"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </Field>
            )}

            <Field label="Low Stock Alert Threshold">
              <input
                type="number"
                min="0"
                className={inputClass}
                placeholder="5"
                value={form.low_stock_threshold}
                onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
              />
            </Field>
          </div>

          {/* Product Image Upload Section */}
          <div className="space-y-2 pt-2 border-t border-[#3A3A3A]">
            <span className="block text-xs font-semibold text-[#A3A3A3]">Product Image</span>
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] overflow-hidden flex items-center justify-center shrink-0 relative">
                {uploadingImage ? (
                  <Loader2 size={24} className="animate-spin text-[#F97316]" />
                ) : imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview('')
                        setForm((f) => ({ ...f, image: '' }))
                      }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/70 hover:bg-rose-600 text-white transition-colors"
                      title="Remove image"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <Package size={28} className="text-[#A3A3A3]" />
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#333] border border-[#3A3A3A] text-white text-xs font-semibold cursor-pointer transition-colors">
                  <Upload size={14} className="text-[#F97316]" />
                  <span>{uploadingImage ? 'Uploading to Vercel Blob…' : 'Choose Image (JPG, PNG, WebP)'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={handleImageChange}
                  />
                </label>
                <p className="text-xs text-[#A3A3A3]">
                  Max file size: 5 MB. Image is stored securely on Vercel Blob.
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-white pt-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#F97316] w-4 h-4 rounded"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span>Active in store catalog and POS</span>
          </label>

          <div className="form-actions pt-3 border-t border-[#3A3A3A]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 px-4 rounded-xl border border-[#3A3A3A] hover:bg-[#1A1A1A] text-white font-medium"
            >
              Cancel
            </button>
            <button
              disabled={busy || uploadingImage}
              className="h-10 px-5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold disabled:opacity-50 transition-colors shadow-lg"
            >
              {busy ? 'Saving…' : 'Save Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!confirm}
        title="Delete this product?"
        message="This will remove the product from the catalog. Existing order history will safely retain product name, price, and snapshot details."
        confirmLabel="Delete Product"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
