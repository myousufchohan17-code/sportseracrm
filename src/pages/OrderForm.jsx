import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Plus, Printer, Trash2 } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../context'
import { ReceiptActions, ReceiptDocument, printReceipt } from '../components/Receipt'
import { ConfirmDialog, EmptyState, Field, Modal, Spinner, StatusBadge, inputClass } from '../components/ui'
import { ORDER_STATUSES, formatDateTime, money } from '../utils'

const emptyCustomer = { name: '', phone: '', email: '', address: '', city: '' }
const emptyProduct = { name: '', price: '', stock: 1 }

function nid(value) {
  return value && String(value).trim() ? value : null
}

export function OrderForm({ mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { settings, toast } = useApp()
  const view = mode === 'view'
  const [loading, setLoading] = useState(mode !== 'create')
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [customerModal, setCustomerModal] = useState(false)
  const [productModal, setProductModal] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(Boolean(location.state?.openReceipt))
  const [newCustomer, setNewCustomer] = useState(emptyCustomer)
  const [newProduct, setNewProduct] = useState(emptyProduct)
  const [confirm, setConfirm] = useState(null)
  const [picker, setPicker] = useState('')
  const [form, setForm] = useState({
    customer_id: '',
    status: 'pending',
    discount: 0,
    discount_type: 'fixed',
    notes: '',
    items: [],
  })
  const [orderMeta, setOrderMeta] = useState(null)

  const loadLists = async () => {
    const [c, p] = await Promise.all([
      api('/customers?limit=100'),
      api('/products?limit=200&status=active'),
    ])
    setCustomers(c.items || [])
    setProducts(p.items || [])
  }

  useEffect(() => {
    loadLists().catch((err) => toast(err.message, 'error'))
  }, [])

  useEffect(() => {
    if (!id) return
    api(`/orders/${id}`).then((order) => {
      setOrderMeta(order)
      setForm({
        customer_id: order.customer_id || '',
        status: order.status,
        discount: order.discount_type === 'percent' && order.subtotal
          ? Number(((Number(order.discount) / Number(order.subtotal)) * 100).toFixed(2))
          : order.discount,
        discount_type: order.discount_type || 'fixed',
        notes: order.notes || '',
        items: (order.items || []).map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      })
    }).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false))
  }, [id])

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0)
    let discount = Number(form.discount) || 0
    if (form.discount_type === 'percent') discount = subtotal * (discount / 100)
    discount = Math.min(Math.max(discount, 0), subtotal)
    const taxRate = Number(settings.tax_rate || 0)
    const tax = (subtotal - discount) * (taxRate / 100)
    return { subtotal, discount, tax, total: subtotal - discount + tax }
  }, [form, settings.tax_rate])

  const addProduct = (productId) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setForm((f) => {
      const existing = f.items.find((i) => i.product_id === product.id)
      if (existing) {
        return { ...f, items: f.items.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { ...f, items: [...f.items, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: Number(product.price) || 0 }] }
    })
  }

  const payload = () => ({
    customer_id: nid(form.customer_id),
    status: form.status || 'pending',
    discount: Number(form.discount) || 0,
    discount_type: form.discount_type || 'fixed',
    notes: form.notes,
    items: form.items.map((item) => ({
      product_id: nid(item.product_id),
      product_name: item.product_name,
      quantity: Math.max(1, Number(item.quantity) || 1),
      unit_price: Number(item.unit_price) || 0,
    })),
  })

  const save = async (e) => {
    e.preventDefault()
    if (!form.items.length) {
      toast('Add at least one product to the order', 'error')
      return
    }
    setSaving(true)
    try {
      const saved = mode === 'create'
        ? await api('/orders', { method: 'POST', body: payload() })
        : await api(`/orders/${id}`, { method: 'PUT', body: payload() })
      toast(mode === 'create' ? 'Order created' : 'Order updated')
      navigate(`/orders/${saved.id}`, { state: { openReceipt: true } })
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const createCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast('Customer name is required', 'error')
      return
    }
    setSaving(true)
    try {
      const created = await api('/customers', { method: 'POST', body: newCustomer })
      setCustomers((c) => [created, ...c])
      setForm((f) => ({ ...f, customer_id: created.id }))
      setCustomerModal(false)
      setNewCustomer(emptyCustomer)
      toast('Customer added')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const createProduct = async () => {
    if (!newProduct.name.trim()) {
      toast('Product name is required', 'error')
      return
    }
    setSaving(true)
    try {
      const created = await api('/products', {
        method: 'POST',
        body: {
          name: newProduct.name,
          price: Number(newProduct.price) || 0,
          stock: Math.max(0, Number(newProduct.stock) || 0),
          active: true,
        },
      })
      setProducts((list) => [created, ...list])
      setForm((f) => {
        if (f.items.some((i) => i.product_id === created.id)) return f
        return {
          ...f,
          items: [...f.items, { product_id: created.id, product_name: created.name, quantity: 1, unit_price: Number(created.price) || 0 }],
        }
      })
      setProductModal(false)
      setNewProduct(emptyProduct)
      toast('Product added to order')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    const ok = printReceipt(orderMeta, settings)
    if (!ok) toast('Allow pop-ups to print the receipt', 'error')
  }

  if (loading) return <Spinner />

  const available = products.filter((p) => {
    if (picker.trim() && !p.name.toLowerCase().includes(picker.trim().toLowerCase())) return false
    return true
  })

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold break-words">{view ? orderMeta?.order_number : mode === 'create' ? 'Create Order' : `Edit ${orderMeta?.order_number || 'Order'}`}</h1>
          <p className="text-sm text-muted">{view ? `Created ${formatDateTime(orderMeta?.created_at)}` : 'Add a customer, products, and save. A receipt opens after the order is created.'}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full sm:w-auto">
          {view && (
            <button type="button" onClick={() => setReceiptOpen(true)} className="h-11 px-4 rounded-2xl border border-line font-semibold text-sm inline-flex items-center justify-center gap-2 w-full sm:w-auto">
              <Printer size={16} /> Receipt
            </button>
          )}
          {view && orderMeta?.status !== 'cancelled' && (
            <select
              className={inputClass + ' w-full sm:w-44'}
              value={orderMeta.status}
              onChange={async (e) => {
                try {
                  const updated = await api(`/orders/${id}/status`, { method: 'PATCH', body: { status: e.target.value } })
                  setOrderMeta(updated)
                  setForm((f) => ({ ...f, status: updated.status }))
                  toast('Status updated')
                } catch (err) {
                  toast(err.message, 'error')
                }
              }}
            >
              {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
          {view && orderMeta?.status !== 'cancelled' && (
            <button type="button" onClick={() => navigate(`/orders/${id}/edit`)} className="h-11 px-4 rounded-2xl border border-line font-semibold text-sm w-full sm:w-auto">Edit</button>
          )}
          {view && ['pending', 'cancelled'].includes(orderMeta?.status) && (
            <button type="button" onClick={() => setConfirm('delete')} className="h-11 px-4 rounded-2xl border border-rose-200 text-rose-500 font-semibold text-sm w-full sm:w-auto">Delete</button>
          )}
          {view && orderMeta?.status !== 'cancelled' && (
            <button type="button" onClick={() => setConfirm('cancel')} className="h-11 px-4 rounded-2xl bg-rose-500 text-white font-semibold text-sm w-full sm:w-auto">Cancel order</button>
          )}
          {!view && (
            <button type="submit" disabled={saving} className="h-11 px-4 rounded-2xl bg-bloom text-white font-semibold text-sm disabled:opacity-60 w-full sm:w-auto">
              {saving ? 'Saving…' : mode === 'create' ? 'Create Order' : 'Update Order'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="card p-4 sm:p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Customer">
                <div className="flex gap-2">
                  <select disabled={view} className={inputClass} value={form.customer_id} onChange={(e) => {
                    const customer = customers.find((c) => c.id === e.target.value)
                    setForm((f) => ({ ...f, customer_id: e.target.value }))
                  }}>
                    <option value="">Walk-in / no customer</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
                  </select>
                  {!view && <button type="button" onClick={() => setCustomerModal(true)} className="px-3 rounded-xl border border-line shrink-0" title="Add customer"><Plus size={16} /></button>}
                </div>
              </Field>
              <Field label="Status">
                <select disabled={view} className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-col gap-3 px-4 sm:px-5 py-4 border-b border-line">
              <h2 className="font-semibold">Products</h2>
              {!view && (
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <input value={picker} onChange={(e) => setPicker(e.target.value)} placeholder="Search products" className={inputClass + ' sm:w-40'} />
                  <select className={inputClass + ' sm:min-w-[180px] flex-1'} value="" onChange={(e) => { addProduct(e.target.value); setPicker('') }}>
                    <option value="">Add a product…</option>
                    {available.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.stock <= 0 && !settings.allow_backorder}>
                        {p.name} · {money(p.price, settings.currency_symbol)} · stock {p.stock}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setProductModal(true)} className="h-11 px-3 rounded-xl border border-line text-sm font-semibold w-full sm:w-auto shrink-0">New product</button>
                </div>
              )}
            </div>
            {form.items.length === 0 ? (
              <EmptyState
                title="No products added"
                description={products.length ? 'Choose a product from the list, or create one now.' : 'There are no products in the catalog yet. Create one to start the order.'}
                actionLabel={view ? undefined : 'Add product'}
                onAction={view ? undefined : () => setProductModal(true)}
              />
            ) : (
              <>
                <div className="md:hidden divide-y divide-line">
                  {form.items.map((item, idx) => (
                    <div key={item.product_id || idx} className="px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm min-w-0">{item.product_name}</p>
                        {!view && (
                          <button type="button" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="p-2 text-rose-500 shrink-0">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Qty">
                          {view ? <p className="text-sm">{item.quantity}</p> : (
                            <input type="number" min="1" className={inputClass} value={item.quantity} onChange={(e) => {
                              const quantity = Math.max(1, Number(e.target.value) || 1)
                              setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, quantity } : it) }))
                            }} />
                          )}
                        </Field>
                        <div className="text-right">
                          <p className="text-xs text-muted">Line total</p>
                          <p className="text-sm font-semibold mt-1">{money(item.quantity * item.unit_price, settings.currency_symbol)}</p>
                          <p className="text-xs text-muted">{money(item.unit_price, settings.currency_symbol)} each</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto table-scroll">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted bg-canvas/70">
                      <tr>
                        <th className="text-left px-4 py-3">Product</th>
                        <th className="text-left px-4 py-3">Qty</th>
                        <th className="text-left px-4 py-3">Price</th>
                        <th className="text-left px-4 py-3">Total</th>
                        {!view && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, idx) => (
                        <tr key={item.product_id || idx} className="border-t border-line">
                          <td className="px-4 py-3 font-medium">{item.product_name}</td>
                          <td className="px-4 py-3">
                            {view ? item.quantity : (
                              <input type="number" min="1" className={inputClass + ' w-20'} value={item.quantity} onChange={(e) => {
                                const quantity = Math.max(1, Number(e.target.value) || 1)
                                setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, quantity } : it) }))
                              }} />
                            )}
                          </td>
                          <td className="px-4 py-3">{money(item.unit_price, settings.currency_symbol)}</td>
                          <td className="px-4 py-3">{money(item.quantity * item.unit_price, settings.currency_symbol)}</td>
                          {!view && (
                            <td className="px-4 py-3 text-right">
                              <button type="button" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="p-2 text-rose-500">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold">Totals</h2>
            <Row label="Subtotal" value={money(totals.subtotal, settings.currency_symbol)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select disabled={view} className={inputClass} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                <option value="fixed">Fixed discount</option>
                <option value="percent">Percent discount</option>
              </select>
              <input disabled={view} type="number" min="0" step="0.01" className={inputClass} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            <Row label="Discount" value={`- ${money(totals.discount, settings.currency_symbol)}`} />
            <Row label={`Tax (${settings.tax_rate || 0}%)`} value={money(totals.tax, settings.currency_symbol)} />
            <div className="flex items-center justify-between pt-2 border-t border-line">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-bloom">{money(totals.total, settings.currency_symbol)}</span>
            </div>
            {view && <StatusBadge status={orderMeta?.status} />}
          </div>
        </div>
      </div>

      <Modal open={customerModal} title="Add customer" onClose={() => setCustomerModal(false)}>
        <div className="space-y-3">
          <Field label="Name"><input required className={inputClass} value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputClass} value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className={inputClass} value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} /></Field>
          <Field label="Address"><input className={inputClass} value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} /></Field>
          <div className="form-actions">
            <button type="button" onClick={() => setCustomerModal(false)} className="h-10 px-4 rounded-xl border">Cancel</button>
            <button type="button" disabled={saving} onClick={createCustomer} className="h-10 px-4 rounded-xl bg-bloom text-white font-semibold">Save customer</button>
          </div>
        </div>
      </Modal>

      <Modal open={productModal} title="New product" onClose={() => setProductModal(false)}>
        <div className="space-y-3">
          <Field label="Name"><input className={inputClass} value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Price"><input type="number" min="0" step="0.01" className={inputClass} value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} /></Field>
            <Field label="Stock"><input type="number" min="0" className={inputClass} value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} /></Field>
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => setProductModal(false)} className="h-10 px-4 rounded-xl border">Cancel</button>
            <button type="button" disabled={saving} onClick={createProduct} className="h-10 px-4 rounded-xl bg-bloom text-white font-semibold">Add to order</button>
          </div>
        </div>
      </Modal>

      <Modal open={receiptOpen && !!orderMeta} title={`Receipt ${orderMeta?.order_number || ''}`} onClose={() => setReceiptOpen(false)} slim>
        <ReceiptDocument order={orderMeta} settings={settings} />
        <ReceiptActions onClose={() => setReceiptOpen(false)} onPrint={handlePrint} />
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'delete' ? 'Delete this order?' : 'Cancel this order?'}
        message={confirm === 'delete' ? 'Only pending or cancelled orders can be deleted.' : 'Stock will be restored if it was already deducted.'}
        confirmLabel={confirm === 'delete' ? 'Delete' : 'Cancel order'}
        busy={saving}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setSaving(true)
          try {
            if (confirm === 'delete') {
              await api(`/orders/${id}`, { method: 'DELETE' })
              toast('Order deleted')
              navigate('/orders')
            } else {
              await api(`/orders/${id}/cancel`, { method: 'POST' })
              toast('Order cancelled')
              const order = await api(`/orders/${id}`)
              setOrderMeta(order)
              setForm((f) => ({ ...f, status: 'cancelled' }))
              setConfirm(null)
            }
          } catch (err) {
            toast(err.message, 'error')
          } finally {
            setSaving(false)
          }
        }}
      />
    </form>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
