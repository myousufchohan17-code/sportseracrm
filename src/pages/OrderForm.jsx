import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Plus, Minus, Trash2, Printer, Search, ShoppingBag,
  Package, UserPlus, ArrowLeft, RefreshCw, X, Check
} from 'lucide-react'
import { api } from '../api'
import { useApp } from '../context'
import { ReceiptActions, ReceiptDocument, printReceipt } from '../components/Receipt'
import { ConfirmDialog, EmptyState, Field, Modal, Spinner, StatusBadge, inputClass } from '../components/ui'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ORDER_STATUSES, formatDateTime, money } from '../utils'

const CART_STORAGE_KEY = 'risports_pos_cart'

const emptyCustomer = { name: '', phone: '', email: '', address: '', city: '' }
const emptyProduct = { name: '', price: '', stock: 1, category_id: '' }

function nid(value) {
  return value && String(value).trim() ? value : null
}

export function OrderForm({ mode = 'create' }) {
  return (
    <ErrorBoundary>
      <OrderFormInner mode={mode} />
    </ErrorBoundary>
  )
}

function OrderFormInner({ mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { settings, toast } = useApp()
  const view = mode === 'view'
  const isPos = mode === 'create'

  const [loading, setLoading] = useState(mode !== 'create')
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals & Receipts
  const [customerModal, setCustomerModal] = useState(false)
  const [productModal, setProductModal] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(Boolean(location.state?.openReceipt))
  const [newCustomer, setNewCustomer] = useState(emptyCustomer)
  const [newProduct, setNewProduct] = useState(emptyProduct)
  const [confirm, setConfirm] = useState(null)
  const [activeTab, setActiveTab] = useState('catalog') // For mobile: 'catalog' | 'cart'

  // Cart / Form state
  const [form, setForm] = useState(() => {
    if (mode === 'create') {
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          return {
            customer_id: parsed.customer_id || '',
            status: 'confirmed',
            discount: Number(parsed.discount) || 0,
            discount_type: parsed.discount_type || 'fixed',
            notes: parsed.notes || '',
            items: Array.isArray(parsed.items) ? parsed.items : [],
          }
        }
      } catch (err) {
        console.error('Failed to restore POS cart:', err)
      }
    }
    return {
      customer_id: '',
      status: mode === 'create' ? 'confirmed' : 'pending',
      discount: 0,
      discount_type: 'fixed',
      notes: '',
      items: [],
    }
  })

  const [orderMeta, setOrderMeta] = useState(null)

  // Persist POS cart to localStorage on create mode
  useEffect(() => {
    if (isPos) {
      try {
        localStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify({
            customer_id: form.customer_id,
            discount: form.discount,
            discount_type: form.discount_type,
            notes: form.notes,
            items: form.items,
          })
        )
      } catch (e) {
        console.error('Error saving cart to storage:', e)
      }
    }
  }, [form, isPos])

  // Load products, categories, customers
  const loadLists = async () => {
    try {
      const [c, p, cats] = await Promise.all([
        api('/customers?limit=200').catch(() => ({ items: [] })),
        api('/products?limit=300&status=active').catch(() => ({ items: [] })),
        api('/categories').catch(() => ({ items: [] })),
      ])
      setCustomers(Array.isArray(c?.items) ? c.items : [])
      setProducts(Array.isArray(p?.items) ? p.items : [])
      setCategories(Array.isArray(cats?.items) ? cats.items : [])
    } catch (err) {
      console.error('Failed to load lists:', err)
      toast('Failed to load products or customers', 'error')
    }
  }

  useEffect(() => {
    loadLists()
  }, [])

  // Load existing order for view/edit
  useEffect(() => {
    if (!id) return
    setLoading(true)
    api(`/orders/${id}`)
      .then((order) => {
        if (!order) return
        setOrderMeta(order)
        setForm({
          customer_id: order.customer_id || '',
          status: order.status || 'pending',
          discount: order.discount_type === 'percent' && order.subtotal
            ? Number(((Number(order.discount) / Number(order.subtotal)) * 100).toFixed(2))
            : (Number(order.discount) || 0),
          discount_type: order.discount_type || 'fixed',
          notes: order.notes || '',
          items: (order.items || []).map((i) => ({
            product_id: i.product_id || null,
            product_name: i.product_name || 'Item',
            quantity: Math.max(1, Number(i.quantity) || 1),
            unit_price: Number(i.unit_price) || 0,
            image: i.image || '',
          })),
        })
      })
      .catch((err) => toast(err.message || 'Failed to load order', 'error'))
      .finally(() => setLoading(false))
  }, [id])

  // Calculate totals safely with null checks
  const totals = useMemo(() => {
    const items = Array.isArray(form?.items) ? form.items : []
    const subtotal = items.reduce((s, i) => s + (Number(i?.quantity) || 0) * (Number(i?.unit_price) || 0), 0)
    let discount = Number(form?.discount) || 0
    if (form?.discount_type === 'percent') {
      discount = subtotal * (discount / 100)
    }
    discount = Math.min(Math.max(discount, 0), subtotal)
    const taxRate = Number(settings?.tax_rate || 0)
    const tax = (subtotal - discount) * (taxRate / 100)
    const total = subtotal - discount + tax
    return {
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
    }
  }, [form?.items, form?.discount, form?.discount_type, settings?.tax_rate])

  // POS Add product to cart
  const addProductToCart = (product) => {
    if (!product || !product.id) return
    const allowBackorder = Boolean(settings?.allow_backorder)
    if (product.stock <= 0 && !allowBackorder) {
      toast(`"${product.name}" is currently out of stock`, 'error')
      return
    }

    setForm((f) => {
      const items = Array.isArray(f.items) ? [...f.items] : []
      const idx = items.findIndex((i) => i.product_id === product.id)
      if (idx >= 0) {
        const currentQty = items[idx].quantity
        if (!allowBackorder && currentQty + 1 > product.stock) {
          toast(`Cannot exceed available stock (${product.stock})`, 'error')
          return f
        }
        items[idx] = { ...items[idx], quantity: currentQty + 1 }
        return { ...f, items }
      }
      return {
        ...f,
        items: [
          ...items,
          {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: Number(product.price) || 0,
            image: product.image || '',
            stock: product.stock,
          },
        ],
      }
    })
  }

  // Update item quantity
  const updateQuantity = (index, delta) => {
    setForm((f) => {
      const items = [...f.items]
      const item = items[index]
      if (!item) return f
      const nextQty = item.quantity + delta
      if (nextQty <= 0) {
        items.splice(index, 1)
      } else {
        items[index] = { ...item, quantity: nextQty }
      }
      return { ...f, items }
    })
  }

  // Remove item
  const removeItem = (index) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }))
  }

  // Clear Cart
  const clearCart = () => {
    setForm((f) => ({
      ...f,
      items: [],
      discount: 0,
      notes: '',
    }))
    try {
      localStorage.removeItem(CART_STORAGE_KEY)
    } catch {}
    toast('Cart cleared')
  }

  // Save / Create Order
  const handleSaveOrder = async (e) => {
    if (e) e.preventDefault()
    if (!form.items || form.items.length === 0) {
      toast('Add at least one product to the order', 'error')
      return
    }

    setSaving(true)
    const payload = {
      customer_id: nid(form.customer_id),
      status: form.status || 'confirmed',
      discount: Number(form.discount) || 0,
      discount_type: form.discount_type || 'fixed',
      notes: form.notes || '',
      items: form.items.map((item) => ({
        product_id: nid(item.product_id),
        product_name: item.product_name || 'Item',
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: Number(item.unit_price) || 0,
        image: item.image || '',
      })),
    }

    try {
      if (mode === 'create') {
        const created = await api('/orders', { method: 'POST', body: payload })
        toast('Order created successfully')
        // Clear local storage cart
        try {
          localStorage.removeItem(CART_STORAGE_KEY)
        } catch {}
        // Open receipt modal directly on order page
        navigate(`/orders/${created.id}`, { state: { openReceipt: true } })
      } else {
        const updated = await api(`/orders/${id}`, { method: 'PUT', body: payload })
        toast('Order updated successfully')
        setOrderMeta(updated)
        navigate(`/orders/${updated.id}`)
      }
    } catch (err) {
      toast(err.message || 'Failed to save order', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Quick Customer Creation
  const createCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast('Customer name is required', 'error')
      return
    }
    setSaving(true)
    try {
      const created = await api('/customers', { method: 'POST', body: newCustomer })
      setCustomers((prev) => [created, ...prev])
      setForm((f) => ({ ...f, customer_id: created.id }))
      setCustomerModal(false)
      setNewCustomer(emptyCustomer)
      toast('Customer added')
    } catch (err) {
      toast(err.message || 'Failed to add customer', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Quick Product Creation
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
          name: newProduct.name.trim(),
          category_id: newProduct.category_id || null,
          price: Number(newProduct.price) || 0,
          stock: Math.max(0, Number(newProduct.stock) || 0),
          active: true,
        },
      })
      setProducts((list) => [created, ...list])
      addProductToCart(created)
      setProductModal(false)
      setNewProduct(emptyProduct)
      toast('Product added to catalog and cart')
    } catch (err) {
      toast(err.message || 'Failed to create product', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    const ok = printReceipt(orderMeta, settings)
    if (!ok) toast('Allow pop-ups to print the receipt', 'error')
  }

  if (loading) return <Spinner label="Loading order details…" />

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    if (!p) return false
    const matchesSearch = !searchQuery.trim() || (p.name && p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Selected customer name
  const selectedCustomer = customers.find((c) => c.id === form.customer_id)

  // VIEW MODE: Order Details View
  if (view) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="p-2.5 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] hover:bg-[#262626] text-[#A3A3A3] hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{orderMeta?.order_number || 'Order'}</h1>
                <StatusBadge status={orderMeta?.status} />
              </div>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                Created {formatDateTime(orderMeta?.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReceiptOpen(true)}
              className="h-10 px-4 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] hover:bg-[#262626] text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors"
            >
              <Printer size={16} /> Receipt
            </button>
            {orderMeta?.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => navigate(`/orders/${id}/edit`)}
                className="h-10 px-4 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] hover:bg-[#262626] text-white font-semibold text-sm transition-colors"
              >
                Edit
              </button>
            )}
            {orderMeta?.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => setConfirm('cancel')}
                className="h-10 px-4 rounded-xl bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/30 text-rose-400 font-semibold text-sm transition-colors"
              >
                Cancel Order
              </button>
            )}
            {['pending', 'cancelled'].includes(orderMeta?.status) && (
              <button
                type="button"
                onClick={() => setConfirm('delete')}
                className="h-10 px-4 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-semibold text-sm transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center justify-between">
                <h2 className="font-semibold text-white">Order Items ({orderMeta?.items?.length || 0})</h2>
                <span className="text-sm font-semibold text-[#F97316]">{money(orderMeta?.total, settings.currency_symbol)}</span>
              </div>
              <div className="divide-y divide-[#3A3A3A]">
                {(orderMeta?.items || []).map((item, idx) => (
                  <div key={item.id || idx} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] border border-[#3A3A3A] overflow-hidden flex items-center justify-center shrink-0">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={20} className="text-[#A3A3A3]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{item.product_name}</p>
                        <p className="text-xs text-[#A3A3A3]">
                          {money(item.unit_price, settings.currency_symbol)} × {item.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-white">{money(item.total ?? (item.quantity * item.unit_price), settings.currency_symbol)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {orderMeta?.notes && (
              <div className="card p-4">
                <p className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-white">{orderMeta.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-white">Customer Information</h2>
              {orderMeta?.customer ? (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs text-[#A3A3A3] block">Name</span>
                    <span className="font-semibold text-white">{orderMeta.customer.name}</span>
                  </div>
                  {orderMeta.customer.phone && (
                    <div>
                      <span className="text-xs text-[#A3A3A3] block">Phone</span>
                      <span className="text-white">{orderMeta.customer.phone}</span>
                    </div>
                  )}
                  {orderMeta.customer.email && (
                    <div>
                      <span className="text-xs text-[#A3A3A3] block">Email</span>
                      <span className="text-white">{orderMeta.customer.email}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#A3A3A3]">Walk-in customer</p>
              )}
            </div>

            <div className="card p-5 space-y-3">
              <h2 className="font-semibold text-white">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-[#A3A3A3]">
                  <span>Subtotal</span>
                  <span className="text-white">{money(orderMeta?.subtotal, settings.currency_symbol)}</span>
                </div>
                {Number(orderMeta?.discount) > 0 && (
                  <div className="flex justify-between text-orange-400">
                    <span>Discount</span>
                    <span>- {money(orderMeta?.discount, settings.currency_symbol)}</span>
                  </div>
                )}
                {Number(orderMeta?.tax) > 0 && (
                  <div className="flex justify-between text-[#A3A3A3]">
                    <span>Tax</span>
                    <span className="text-white">{money(orderMeta?.tax, settings.currency_symbol)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-[#3A3A3A] font-bold text-base">
                  <span className="text-white">Total</span>
                  <span className="text-[#F97316] text-xl">{money(orderMeta?.total, settings.currency_symbol)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Modal open={receiptOpen && !!orderMeta} title={`Receipt #${orderMeta?.order_number || ''}`} onClose={() => setReceiptOpen(false)} slim>
          <ReceiptDocument order={orderMeta} settings={settings} />
          <ReceiptActions onClose={() => setReceiptOpen(false)} onPrint={handlePrint} />
        </Modal>

        <ConfirmDialog
          open={!!confirm}
          title={confirm === 'delete' ? 'Delete this order?' : 'Cancel this order?'}
          message={confirm === 'delete' ? 'Only pending or cancelled orders can be deleted.' : 'Stock will be restored to inventory.'}
          confirmLabel={confirm === 'delete' ? 'Delete' : 'Cancel Order'}
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
                const refreshed = await api(`/orders/${id}`)
                setOrderMeta(refreshed)
                setConfirm(null)
              }
            } catch (err) {
              toast(err.message || 'Action failed', 'error')
            } finally {
              setSaving(false)
            }
          }}
        />
      </div>
    )
  }

  // POS INTERFACE (CREATE & EDIT MODES)
  const cartItemCount = form.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#3A3A3A]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {mode === 'create' ? 'Point of Sale' : `Edit ${orderMeta?.order_number || 'Order'}`}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30">
              POS
            </span>
          </div>
          <p className="text-xs text-[#A3A3A3] mt-0.5">
            Tap products to add to cart · Cart auto-saves on refresh
          </p>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="lg:hidden flex items-center gap-2 bg-[#1A1A1A] p-1 rounded-xl border border-[#3A3A3A]">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'catalog' ? 'bg-[#F97316] text-white' : 'text-[#A3A3A3]'
            }`}
          >
            Catalog
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cart')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'cart' ? 'bg-[#F97316] text-white' : 'text-[#A3A3A3]'
            }`}
          >
            <ShoppingBag size={14} />
            <span>Cart ({cartItemCount})</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setProductModal(true)}
            className="h-10 px-3.5 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] hover:bg-[#262626] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus size={15} /> New Product
          </button>
        </div>
      </div>

      {/* Main Grid: Catalog Left (60-65%), Cart Right (35-40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Catalog & Products */}
        <div className={`lg:col-span-7 xl:col-span-8 space-y-4 ${activeTab === 'cart' ? 'hidden lg:block' : 'block'}`}>
          {/* Search & Categories Bar */}
          <div className="card p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by name…"
                  className={`${inputClass} pl-10`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-white"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`${inputClass} sm:w-48`}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Quick Category Pills */}
            {categories.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                    !selectedCategory
                      ? 'bg-[#F97316] text-white border-[#F97316]'
                      : 'bg-[#1A1A1A] text-[#A3A3A3] hover:text-white border-[#3A3A3A]'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                      selectedCategory === cat.id
                        ? 'bg-[#F97316] text-white border-[#F97316]'
                        : 'bg-[#1A1A1A] text-[#A3A3A3] hover:text-white border-[#3A3A3A]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="card p-8">
              <EmptyState
                icon={Package}
                title="No products found"
                description={
                  products.length === 0
                    ? 'Your catalog is empty. Create products to start selling.'
                    : 'No products match your search or filter.'
                }
                actionLabel={products.length === 0 ? 'Create Product' : 'Clear Filter'}
                onAction={
                  products.length === 0
                    ? () => setProductModal(true)
                    : () => { setSearchQuery(''); setSelectedCategory('') }
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredProducts.map((p) => {
                const inCart = form.items.find((i) => i.product_id === p.id)
                const isOutOfStock = p.stock <= 0 && !settings?.allow_backorder
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => addProductToCart(p)}
                    className={`group relative card p-3 text-left transition-all flex flex-col justify-between hover:border-[#F97316] active:scale-[0.98] ${
                      isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'
                    } ${inCart ? 'ring-2 ring-[#F97316] border-[#F97316]' : ''}`}
                  >
                    {/* Badge if in cart */}
                    {inCart && (
                      <span className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-[#F97316] text-white text-xs font-bold flex items-center justify-center shadow-md">
                        {inCart.quantity}
                      </span>
                    )}

                    <div>
                      {/* Product Image */}
                      <div className="w-full aspect-square rounded-xl bg-[#1A1A1A] border border-[#3A3A3A] overflow-hidden flex items-center justify-center mb-2.5">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <Package size={28} className="text-[#A3A3A3]" />
                        )}
                      </div>

                      {/* Product Info */}
                      <p className="font-semibold text-white text-sm line-clamp-1 group-hover:text-[#F97316] transition-colors">
                        {p.name}
                      </p>
                      <p className="text-xs text-[#A3A3A3] line-clamp-1">
                        {p.category?.name || 'General'}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#3A3A3A] flex items-center justify-between">
                      <span className="text-base font-bold text-[#F97316]">
                        {money(p.price, settings?.currency_symbol || '$')}
                      </span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                        p.stock <= 0
                          ? 'bg-rose-500/20 text-rose-400'
                          : p.stock <= (p.low_stock_threshold || 5)
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-[#1A1A1A] text-[#A3A3A3]'
                      }`}>
                        {p.stock <= 0 ? 'Out' : `Stock: ${p.stock}`}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Cart Panel */}
        <div className={`lg:col-span-5 xl:col-span-4 space-y-4 ${activeTab === 'catalog' ? 'hidden lg:block' : 'block'}`}>
          <div className="card p-4 sm:p-5 space-y-4 sticky top-20 shadow-2xl">
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#3A3A3A]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="text-[#F97316]" size={20} />
                <h2 className="font-bold text-white text-base">Cart</h2>
                <span className="px-2 py-0.5 rounded-full bg-[#1A1A1A] border border-[#3A3A3A] text-xs font-semibold text-[#F97316]">
                  {cartItemCount} item{cartItemCount === 1 ? '' : 's'}
                </span>
              </div>
              {form.items.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs text-[#A3A3A3] hover:text-rose-400 transition-colors"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Customer Select */}
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                Customer (Optional)
              </label>
              <div className="flex gap-2">
                <select
                  className={`${inputClass} text-xs`}
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCustomerModal(true)}
                  className="h-10 px-3 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] hover:bg-[#262626] text-white shrink-0 transition-colors"
                  title="Add New Customer"
                >
                  <UserPlus size={16} />
                </button>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="max-h-[300px] overflow-y-auto divide-y divide-[#3A3A3A] pr-1">
              {form.items.length === 0 ? (
                <div className="py-8 text-center text-[#A3A3A3]">
                  <ShoppingBag size={32} className="mx-auto text-[#3A3A3A] mb-2" />
                  <p className="text-sm font-medium">Cart is empty</p>
                  <p className="text-xs mt-1">Tap products from the catalog to add them</p>
                </div>
              ) : (
                form.items.map((item, idx) => (
                  <div key={item.product_id || idx} className="py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white text-sm truncate">{item.product_name}</p>
                      <p className="text-xs text-[#F97316] font-medium">
                        {money(item.unit_price, settings?.currency_symbol || '$')}
                      </p>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, -1)}
                        className="w-6 h-6 rounded-lg bg-[#262626] hover:bg-[#333] text-white flex items-center justify-center transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, 1)}
                        className="w-6 h-6 rounded-lg bg-[#262626] hover:bg-[#333] text-white flex items-center justify-center transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <div className="text-right shrink-0 min-w-[50px]">
                      <p className="text-sm font-bold text-white">
                        {money(item.quantity * item.unit_price, settings?.currency_symbol || '$')}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-1.5 text-[#A3A3A3] hover:text-rose-400 shrink-0 transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Discount and Summary */}
            <div className="pt-3 border-t border-[#3A3A3A] space-y-3">
              <div>
                <span className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Discount</span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className={`${inputClass} text-xs`}
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                  >
                    <option value="fixed">Fixed ($)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className={`${inputClass} text-xs`}
                    value={form.discount || ''}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  />
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="space-y-1.5 text-xs text-[#A3A3A3] pt-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-white font-medium">{money(totals.subtotal, settings?.currency_symbol || '$')}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-orange-400">
                    <span>Discount</span>
                    <span>- {money(totals.discount, settings?.currency_symbol || '$')}</span>
                  </div>
                )}
                {Number(settings?.tax_rate || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Tax ({settings.tax_rate}%)</span>
                    <span className="text-white">{money(totals.tax, settings?.currency_symbol || '$')}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-[#3A3A3A]">
                  <span className="text-sm font-bold text-white">Grand Total</span>
                  <span className="text-xl font-extrabold text-[#F97316]">
                    {money(totals.total, settings?.currency_symbol || '$')}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={saving || form.items.length === 0}
                onClick={handleSaveOrder}
                className="w-full h-12 rounded-xl bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                {saving ? (
                  <>
                    <span className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span>Processing Order…</span>
                  </>
                ) : (
                  <>
                    <span>Create Order</span>
                    <span>·</span>
                    <span>{money(totals.total, settings?.currency_symbol || '$')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Quick Add Customer */}
      <Modal open={customerModal} title="Add Customer" onClose={() => setCustomerModal(false)}>
        <div className="space-y-3">
          <Field label="Customer Name *">
            <input
              required
              className={inputClass}
              placeholder="e.g. John Smith"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              placeholder="e.g. +1 555-0199"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className={inputClass}
              placeholder="john@example.com"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
            />
          </Field>
          <Field label="Address">
            <input
              className={inputClass}
              placeholder="123 Main St"
              value={newCustomer.address}
              onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
            />
          </Field>
          <div className="form-actions pt-2">
            <button
              type="button"
              onClick={() => setCustomerModal(false)}
              className="h-10 px-4 rounded-xl border border-[#3A3A3A] hover:bg-[#1A1A1A] text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={createCustomer}
              className="h-10 px-4 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold"
            >
              Save Customer
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Quick Add Product */}
      <Modal open={productModal} title="New Product" onClose={() => setProductModal(false)}>
        <div className="space-y-3">
          <Field label="Product Name *">
            <input
              required
              className={inputClass}
              placeholder="e.g. Pro Basketball Size 7"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <select
              className={inputClass}
              value={newProduct.category_id}
              onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price *">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                placeholder="29.99"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              />
            </Field>
            <Field label="Opening Stock">
              <input
                type="number"
                min="0"
                className={inputClass}
                placeholder="10"
                value={newProduct.stock}
                onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
              />
            </Field>
          </div>
          <div className="form-actions pt-2">
            <button
              type="button"
              onClick={() => setProductModal(false)}
              className="h-10 px-4 rounded-xl border border-[#3A3A3A] hover:bg-[#1A1A1A] text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={createProduct}
              className="h-10 px-4 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold"
            >
              Add to Catalog & Cart
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
