import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import {
  pool,
  all,
  get,
  run,
  exec,
  uploadDir,
  id,
  nowIso,
  getSetting,
  setSetting,
  getSettings,
  parseJson,
  dayBounds,
  previousPeriod,
  changePct,
  nextOrderNumber,
  notify,
  publicStaff,
  initDb,
} from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json({ limit: '4mb' }))
app.use('/uploads', express.static(uploadDir))

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed'))
      return
    }
    cb(null, true)
  },
})

function requireModule() {
  return (_req, _res, next) => next()
}

function fail(res, status, error) {
  return res.status(status).json({ error })
}

function named(obj) {
  const out = {}
  for (const [key, value] of Object.entries(obj)) out[`$${key}`] = value ?? null
  return out
}

function publicCustomer(row) {
  if (!row) return row
  const { birthday, anniversary, ...rest } = row
  return rest
}

function paginateQuery(req) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10))
  return { page, limit, offset: (page - 1) * limit }
}

function like(value) {
  return `%${String(value || '').trim()}%`
}

async function formatMoney(n) {
  const symbol = await getSetting('currency_symbol', '$')
  return `${symbol}${Number(n || 0).toFixed(2)}`
}

async function productRow(row) {
  if (!row) return null
  const category = row.category_id
    ? await get('SELECT id, name FROM categories WHERE id = $1', row.category_id)
    : null
  const vendor = row.vendor_id
    ? await get('SELECT id, name FROM vendors WHERE id = $1', row.vendor_id)
    : null
  const status = row.stock <= 0 ? 'out' : row.stock <= row.low_stock_threshold ? 'low' : 'in'
  return { ...row, active: Boolean(row.active), category, vendor, stock_status: status }
}

async function orderItems(orderId) {
  return await all('SELECT * FROM order_items WHERE order_id = $1', orderId)
}

async function hydrateOrder(row) {
  if (!row) return null
  const customer = row.customer_id
    ? await get('SELECT id, name, phone, email, address FROM customers WHERE id = $1', row.customer_id)
    : null
  const occasion = row.occasion_id
    ? await get('SELECT id, name, color FROM occasions WHERE id = $1', row.occasion_id)
    : null
  const delivery_staff = row.delivery_staff_id
    ? publicStaff(await get('SELECT * FROM staff WHERE id = $1', row.delivery_staff_id))
    : null
  return {
    ...row,
    stock_applied: Boolean(row.stock_applied),
    items: await orderItems(row.id),
    customer,
    occasion,
    delivery_staff,
  }
}

const STOCK_STATUSES = new Set(['confirmed', 'in_process', 'ready', 'out_for_delivery', 'delivered'])
const ORDER_STATUSES = [
  'pending', 'confirmed', 'in_process', 'ready', 'out_for_delivery', 'delivered', 'cancelled',
]

async function calcTotals({ items, discount = 0, discount_type = 'fixed' }) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0)
  let discountAmount = Number(discount) || 0
  if (discount_type === 'percent') {
    discountAmount = subtotal * (discountAmount / 100)
  }
  discountAmount = Math.min(Math.max(discountAmount, 0), subtotal)
  const taxable = subtotal - discountAmount
  const taxRate = Number(await getSetting('tax_rate', 0)) || 0
  const tax = taxable * (taxRate / 100)
  const total = taxable + tax
  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(discountAmount.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number(total.toFixed(2)),
  }
}

async function applyStock(orderId, reason) {
  const items = await orderItems(orderId)
  const allowBackorder = Boolean(await getSetting('allow_backorder', false))
  for (const item of items) {
    if (!item.product_id) continue
    const product = await get('SELECT * FROM products WHERE id = $1', item.product_id)
    if (!product) continue
    if (!allowBackorder && product.stock < item.quantity) {
      throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}`)
    }
  }
  for (const item of items) {
    if (!item.product_id) continue
    const product = await get('SELECT * FROM products WHERE id = $1', item.product_id)
    if (!product) continue
    const nextStock = product.stock - item.quantity
    await run('UPDATE products SET stock = $1 WHERE id = $2', nextStock, product.id)
    await run(
      `INSERT INTO inventory_movements (id, product_id, delta, reason, reference_id, note, staff_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      id(), product.id, -item.quantity, reason, orderId, `Order stock change`, null, nowIso()
    )
    await maybeStockAlert(product, nextStock)
  }
  await run('UPDATE orders SET stock_applied = 1 WHERE id = $1', orderId)
}

async function restoreStock(orderId, reason) {
  const order = await get('SELECT * FROM orders WHERE id = $1', orderId)
  if (!order?.stock_applied) return
  const items = await orderItems(orderId)
  for (const item of items) {
    if (!item.product_id) continue
    const product = await get('SELECT * FROM products WHERE id = $1', item.product_id)
    if (!product) continue
    const nextStock = product.stock + item.quantity
    await run('UPDATE products SET stock = $1 WHERE id = $2', nextStock, product.id)
    await run(
      `INSERT INTO inventory_movements (id, product_id, delta, reason, reference_id, note, staff_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      id(), product.id, item.quantity, reason, orderId, `Order stock restore`, null, nowIso()
    )
  }
  await run('UPDATE orders SET stock_applied = 0 WHERE id = $1', orderId)
}

async function maybeStockAlert(product, nextStock) {
  const notifyInventory = await getSetting('notify_inventory', true)
  const lowStockNotify = await getSetting('low_stock_notify', true)
  if (!notifyInventory && !lowStockNotify) return
  if (nextStock <= 0) {
    await notify('inventory', 'Out of stock', `${product.name} is out of stock.`, '/inventory')
  } else if (nextStock <= product.low_stock_threshold) {
    await notify('inventory', 'Low stock', `${product.name} is down to ${nextStock} units.`, '/inventory')
  }
}

async function syncDeliveryStatus(orderId, deliveryStatus) {
  const map = {
    scheduled: 'confirmed',
    assigned: 'ready',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
    failed: 'ready',
  }
  const next = map[deliveryStatus]
  if (!next) return
  const order = await get('SELECT * FROM orders WHERE id = $1', orderId)
  if (!order || order.status === 'cancelled') return
  const shouldApply = STOCK_STATUSES.has(next)
  if (shouldApply && !order.stock_applied) await applyStock(orderId, 'order_confirm')
  await run('UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3', next, nowIso(), orderId)
}

async function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Add at least one product to the order')
  }
  const result = []
  for (const item of items) {
    const product = item.product_id
      ? await get('SELECT * FROM products WHERE id = $1', item.product_id)
      : null
    const quantity = Math.max(1, Number(item.quantity) || 1)
    const unit_price = product ? Number(product.price) : Number(item.unit_price) || 0
    result.push({
      product_id: product?.id || null,
      product_name: product?.name || item.product_name || 'Item',
      quantity,
      unit_price,
      total: Number((quantity * unit_price).toFixed(2)),
      stock: product?.stock ?? null,
    })
  }
  return result
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/settings', async (_req, res) => {
  res.json(await getSettings())
})

app.put('/api/settings', async (req, res) => {
  const allowed = [
    'shop_name', 'shop_tagline', 'email', 'phone', 'address', 'currency', 'currency_symbol',
    'tax_rate', 'allow_backorder', 'low_stock_notify', 'order_prefix', 'notify_orders', 'notify_inventory',
  ]
  for (const key of allowed) {
    if (req.body[key] !== undefined) await setSetting(key, req.body[key])
  }
  res.json(await getSettings())
})

app.post('/api/settings/logo', upload.single('logo'), async (req, res) => {
  if (!req.file) return fail(res, 400, 'Please choose a logo image')
  const url = `/uploads/${req.file.filename}`
  await setSetting('logo', url)
  res.json({ logo: url, settings: await getSettings() })
})

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return fail(res, 400, 'Please choose an image')
  res.json({ url: `/uploads/${req.file.filename}` })
})

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) return res.json({ orders: [], customers: [], products: [] })
  const term = like(q)
  const orders = await all(
    `SELECT o.id, o.order_number, o.total, o.status, o.created_at, c.name AS customer_name
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.order_number LIKE $1 OR c.name LIKE $1 OR c.phone LIKE $1
     ORDER BY o.created_at DESC LIMIT 8`,
    term
  )
  const customers = await all(
    `SELECT id, name, phone, email FROM customers
     WHERE name LIKE $1 OR phone LIKE $1 OR email LIKE $1
     ORDER BY created_at DESC LIMIT 8`,
    term
  )
  const products = await all(
    `SELECT id, name, price, stock, image FROM products
     WHERE name LIKE $1 OR description LIKE $1
     ORDER BY created_at DESC LIMIT 8`,
    term
  )
  res.json({ orders, customers, products })
})

app.get('/api/notifications', async (_req, res) => {
  const items = await all('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 40')
  const unreadRow = await get('SELECT COUNT(*) AS c FROM notifications WHERE read = 0')
  res.json({ items, unread: unreadRow?.c || 0 })
})

app.post('/api/notifications/read-all', async (_req, res) => {
  await run('UPDATE notifications SET read = 1')
  res.json({ ok: true })
})

app.patch('/api/notifications/:id/read', async (req, res) => {
  await run('UPDATE notifications SET read = 1 WHERE id = $1', req.params.id)
  res.json({ ok: true })
})

app.get('/api/dashboard', requireModule('dashboard'), async (req, res) => {
  const from = req.query.from
  const to = req.query.to
  const { fromIso, toIso } = dayBounds(from, to)
  const prev = previousPeriod(from, to)

  const countOrders = async (f, t) => {
    const r = await get(`SELECT COUNT(*) AS c FROM orders WHERE created_at >= $1 AND created_at <= $2`, f, t)
    return r?.c || 0
  }
  const sumRevenue = async (f, t) => {
    const r = await get(
      `SELECT COALESCE(SUM(total), 0) AS v FROM orders
       WHERE created_at >= $1 AND created_at <= $2 AND status != 'cancelled'`, f, t)
    return r?.v || 0
  }
  const countCustomers = async (f, t) => {
    const r = await get(`SELECT COUNT(*) AS c FROM customers WHERE created_at >= $1 AND created_at <= $2`, f, t)
    return r?.c || 0
  }
  const countPending = async (f, t) => {
    const r = await get(`SELECT COUNT(*) AS c FROM orders WHERE created_at >= $1 AND created_at <= $2 AND status = 'pending'`, f, t)
    return r?.c || 0
  }

  const orders = await countOrders(fromIso, toIso)
  const revenue = await sumRevenue(fromIso, toIso)
  const customers = await countCustomers(fromIso, toIso)
  const pending = await countPending(fromIso, toIso)

  const prevOrders = await countOrders(prev.fromIso, prev.toIso)
  const prevRevenue = await sumRevenue(prev.fromIso, prev.toIso)
  const prevCustomers = await countCustomers(prev.fromIso, prev.toIso)
  const prevPending = await countPending(prev.fromIso, prev.toIso)

  const statusRows = await all(
    `SELECT status, COUNT(*) AS c FROM orders
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY status`, fromIso, toIso)

  const start = new Date(fromIso)
  const end = new Date(toIso)
  const days = Math.max(1, Math.ceil((end - start) / 86400000))
  const bucket = days <= 14 ? 'day' : days <= 90 ? 'week' : 'month'

  const salesRows = await all(
    `SELECT created_at, total, status FROM orders
     WHERE created_at >= $1 AND created_at <= $2 AND status != 'cancelled'`, fromIso, toIso)

  const buckets = new Map()
  for (const row of salesRows) {
    const d = new Date(row.created_at)
    let key
    if (bucket === 'day') key = d.toISOString().slice(0, 10)
    else if (bucket === 'week') {
      const tmp = new Date(d)
      const day = (tmp.getDay() + 6) % 7
      tmp.setDate(tmp.getDate() - day)
      key = tmp.toISOString().slice(0, 10)
    } else key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, (buckets.get(key) || 0) + Number(row.total))
  }
  const sales_overview = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))

  const top_products = await all(
    `SELECT oi.product_id, oi.product_name,
            SUM(oi.quantity) AS sold,
            SUM(oi.total) AS revenue,
            p.image, p.price
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.created_at >= $1 AND o.created_at <= $2 AND o.status != 'cancelled'
     GROUP BY oi.product_id, oi.product_name, p.image, p.price
     ORDER BY sold DESC
     LIMIT 5`, fromIso, toIso)

  const recent_orders = await all(
    `SELECT o.*, c.name AS customer_name
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.created_at >= $1 AND o.created_at <= $2
     ORDER BY o.created_at DESC LIMIT 6`, fromIso, toIso)
  const hydratedRecentOrders = []
  for (const o of recent_orders) {
    hydratedRecentOrders.push(await hydrateOrder(o))
  }

  const occasions = await all(
    `SELECT oc.id, oc.name, oc.color, COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS revenue
     FROM occasions oc
     LEFT JOIN orders o ON o.occasion_id = oc.id
       AND o.created_at >= $1 AND o.created_at <= $2 AND o.status != 'cancelled'
     GROUP BY oc.id
     ORDER BY orders DESC`, fromIso, toIso)

  const featuredCampaign = await get(
    `SELECT * FROM campaigns WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`)

  const lowStockRow = await get(
    `SELECT COUNT(*) AS c FROM products WHERE active = 1 AND stock <= low_stock_threshold`)
  const lowStock = lowStockRow?.c || 0

  const currencySymbol = await getSetting('currency_symbol', '$')

  res.json({
    stats: {
      orders: { value: orders, change: changePct(orders, prevOrders) },
      customers: { value: customers, change: changePct(customers, prevCustomers) },
      revenue: { value: Number(Number(revenue).toFixed(2)), change: changePct(revenue, prevRevenue) },
      pending: { value: pending, change: changePct(pending, prevPending) },
      low_stock: lowStock,
    },
    sales_overview,
    order_status: ORDER_STATUSES.map((status) => ({
      status,
      count: statusRows.find((r) => r.status === status)?.c || 0,
    })),
    top_products,
    recent_orders: hydratedRecentOrders,
    occasions,
    campaign: featuredCampaign || null,
    currency_symbol: currencySymbol,
  })
})

app.get('/api/customers', requireModule('customers'), async (req, res) => {
  const { page, limit, offset } = paginateQuery(req)
  const q = String(req.query.search || '').trim()
  const where = q ? 'WHERE name LIKE $1 OR phone LIKE $1 OR email LIKE $1' : ''
  const params = q ? [like(q)] : []
  const totalRow = await get(`SELECT COUNT(*) AS c FROM customers ${where}`, ...params)
  const total = totalRow?.c || 0
  const items = await all(
    `SELECT c.*,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
      (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled') AS spent
     FROM customers c ${where}
     ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    ...params, limit, offset)
  res.json({ items: items.map(publicCustomer), total, page, limit, pages: Math.ceil(total / limit) || 1 })
})

app.get('/api/customers/:id', requireModule('customers'), async (req, res) => {
  const customer = await get('SELECT * FROM customers WHERE id = $1', req.params.id)
  if (!customer) return fail(res, 404, 'Customer not found')
  const orders = await all(
    'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', customer.id)
  const hydratedOrders = []
  for (const o of orders) {
    hydratedOrders.push(await hydrateOrder(o))
  }
  res.json({ ...publicCustomer(customer), orders: hydratedOrders })
})

app.post('/api/customers', requireModule('customers'), async (req, res) => {
  const { name, phone, email, address, city, notes } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Customer name is required')
  if (phone?.trim()) {
    const dup = await get('SELECT id FROM customers WHERE phone = $1', phone.trim())
    if (dup) return fail(res, 400, 'A customer with this phone already exists')
  }
  const row = {
    id: id(),
    name: name.trim(),
    phone: phone?.trim() || '',
    email: email?.trim() || '',
    address: address?.trim() || '',
    city: city?.trim() || '',
    notes: notes?.trim() || '',
    created_at: nowIso(),
  }
  await run(
    `INSERT INTO customers (id, name, phone, email, address, city, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    row.id, row.name, row.phone, row.email, row.address, row.city, row.notes, row.created_at
  )
  res.status(201).json(row)
})

app.put('/api/customers/:id', requireModule('customers'), async (req, res) => {
  const existing = await get('SELECT * FROM customers WHERE id = $1', req.params.id)
  if (!existing) return fail(res, 404, 'Customer not found')
  const { name, phone, email, address, city, notes } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Customer name is required')
  await run(
    `UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, city=$5, notes=$6
     WHERE id=$7`,
    name.trim(), phone?.trim() || '', email?.trim() || '', address?.trim() || '',
    city?.trim() || '', notes?.trim() || '', req.params.id
  )
  const updated = await get('SELECT * FROM customers WHERE id = $1', req.params.id)
  res.json(publicCustomer(updated))
})

app.delete('/api/customers/:id', requireModule('customers'), async (req, res) => {
  const ordersRow = await get('SELECT COUNT(*) AS c FROM orders WHERE customer_id = $1', req.params.id)
  if (ordersRow?.c) return fail(res, 400, 'This customer has orders and cannot be deleted')
  const info = await run('DELETE FROM customers WHERE id = $1', req.params.id)
  if (!info.changes) return fail(res, 404, 'Customer not found')
  res.json({ ok: true })
})

app.get('/api/categories', requireModule('categories'), async (req, res) => {
  const q = String(req.query.search || '').trim()
  const items = await all(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
     FROM categories c
     ${q ? 'WHERE c.name LIKE $1' : ''}
     ORDER BY c.created_at DESC`,
    ...(q ? [like(q)] : []))
  res.json({ items })
})

app.get('/api/categories/:id', requireModule('categories'), async (req, res) => {
  const category = await get('SELECT * FROM categories WHERE id = $1', req.params.id)
  if (!category) return fail(res, 404, 'Category not found')
  const products = await all('SELECT * FROM products WHERE category_id = $1 ORDER BY name', category.id)
  const hydratedProducts = []
  for (const p of products) {
    hydratedProducts.push(await productRow(p))
  }
  res.json({ ...category, products: hydratedProducts })
})

app.post('/api/categories', requireModule('categories'), async (req, res) => {
  const { name, description } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Category name is required')
  const dup = await get('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', name.trim())
  if (dup) return fail(res, 400, 'A category with this name already exists')
  const row = { id: id(), name: name.trim(), description: description?.trim() || '', created_at: nowIso() }
  await run('INSERT INTO categories (id, name, description, created_at) VALUES ($1, $2, $3, $4)',
    row.id, row.name, row.description, row.created_at)
  res.status(201).json(row)
})

app.put('/api/categories/:id', requireModule('categories'), async (req, res) => {
  const existing = await get('SELECT * FROM categories WHERE id = $1', req.params.id)
  if (!existing) return fail(res, 404, 'Category not found')
  const { name, description } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Category name is required')
  await run('UPDATE categories SET name=$1, description=$2 WHERE id=$3',
    name.trim(), description?.trim() || '', req.params.id)
  const updated = await get('SELECT * FROM categories WHERE id = $1', req.params.id)
  res.json(updated)
})

app.delete('/api/categories/:id', requireModule('categories'), async (req, res) => {
  const info = await run('DELETE FROM categories WHERE id = $1', req.params.id)
  if (!info.changes) return fail(res, 404, 'Category not found')
  res.json({ ok: true })
})

app.get('/api/products', requireModule('products'), async (req, res) => {
  const { page, limit, offset } = paginateQuery(req)
  const q = String(req.query.search || '').trim()
  const category = req.query.category
  const status = req.query.status
  const clauses = []
  const params = []
  if (q) {
    clauses.push('(name LIKE $' + (params.length + 1) + ' OR description LIKE $' + (params.length + 2) + ')')
    params.push(like(q), like(q))
  }
  if (category) {
    clauses.push('category_id = $' + (params.length + 1))
    params.push(category)
  }
  if (status === 'active') clauses.push('active = 1')
  if (status === 'inactive') clauses.push('active = 0')
  if (status === 'low') clauses.push('stock > 0 AND stock <= low_stock_threshold')
  if (status === 'out') clauses.push('stock <= 0')
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const totalRow = await get(`SELECT COUNT(*) AS c FROM products ${where}`, ...params)
  const total = totalRow?.c || 0
  const items = await all(
    `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    ...params, limit, offset)
  const hydratedItems = []
  for (const item of items) {
    hydratedItems.push(await productRow(item))
  }
  res.json({ items: hydratedItems, total, page, limit, pages: Math.ceil(total / limit) || 1 })
})

app.get('/api/products/:id', requireModule('products'), async (req, res) => {
  const product = await get('SELECT * FROM products WHERE id = $1', req.params.id)
  if (!product) return fail(res, 404, 'Product not found')
  res.json(await productRow(product))
})

app.post('/api/products', requireModule('products'), async (req, res) => {
  const { name, description, category_id, vendor_id, price, cost, stock, low_stock_threshold, image, active } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Product name is required')
  const qty = Math.max(0, Number(stock) || 0)
  const row = {
    id: id(),
    name: name.trim(),
    description: description?.trim() || '',
    category_id: category_id || null,
    vendor_id: vendor_id || null,
    price: Number(price) || 0,
    cost: Number(cost) || 0,
    stock: qty,
    low_stock_threshold: Number(low_stock_threshold) || 5,
    image: image || '',
    active: active === false ? 0 : 1,
    created_at: nowIso(),
  }
  await run(
    `INSERT INTO products (id, name, description, category_id, vendor_id, price, cost, stock, low_stock_threshold, image, active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    row.id, row.name, row.description, row.category_id, row.vendor_id, row.price, row.cost, row.stock, row.low_stock_threshold, row.image, row.active, row.created_at
  )
  if (qty) {
    await run(
      `INSERT INTO inventory_movements (id, product_id, delta, reason, reference_id, note, staff_id, created_at)
       VALUES ($1, $2, $3, 'initial', NULL, 'Opening stock', $4, $5)`,
      id(), row.id, qty, null, nowIso()
    )
  }
  const saved = await get('SELECT * FROM products WHERE id = $1', row.id)
  res.status(201).json(await productRow(saved))
})

app.put('/api/products/:id', requireModule('products'), async (req, res) => {
  const existing = await get('SELECT * FROM products WHERE id = $1', req.params.id)
  if (!existing) return fail(res, 404, 'Product not found')
  const { name, description, category_id, vendor_id, price, cost, low_stock_threshold, image, active } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Product name is required')
  await run(
    `UPDATE products SET name=$1, description=$2, category_id=$3, vendor_id=$4, price=$5, cost=$6, low_stock_threshold=$7, image=$8, active=$9
     WHERE id=$10`,
    name.trim(), description?.trim() || '', category_id || null, vendor_id || null,
    Number(price) || 0, Number(cost) || 0, Number(low_stock_threshold) || 5,
    image ?? existing.image, active === false ? 0 : 1, req.params.id
  )
  const updated = await get('SELECT * FROM products WHERE id = $1', req.params.id)
  res.json(await productRow(updated))
})

app.delete('/api/products/:id', requireModule('products'), async (req, res) => {
  const usedRow = await get('SELECT COUNT(*) AS c FROM order_items WHERE product_id = $1', req.params.id)
  if (usedRow?.c) return fail(res, 400, 'This product is used on orders. Deactivate it instead of deleting.')
  const info = await run('DELETE FROM products WHERE id = $1', req.params.id)
  if (!info.changes) return fail(res, 404, 'Product not found')
  res.json({ ok: true })
})

app.get('/api/inventory', requireModule('inventory'), async (req, res) => {
  const q = String(req.query.search || '').trim()
  const status = req.query.status
  const clauses = []
  const params = []
  if (q) {
    clauses.push('name LIKE $' + (params.length + 1))
    params.push(like(q))
  }
  if (status === 'low') clauses.push('stock > 0 AND stock <= low_stock_threshold')
  if (status === 'out') clauses.push('stock <= 0')
  if (status === 'in') clauses.push('stock > low_stock_threshold')
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const items = await all(`SELECT * FROM products ${where} ORDER BY name`, ...params)
  const history = await all(
    `SELECT m.*, p.name AS product_name, s.name AS staff_name
     FROM inventory_movements m
     JOIN products p ON p.id = m.product_id
     LEFT JOIN staff s ON s.id = m.staff_id
     ORDER BY m.created_at DESC LIMIT 50`)
  const hydratedItems = []
  for (const item of items) {
    hydratedItems.push(await productRow(item))
  }
  res.json({ items: hydratedItems, history })
})

app.post('/api/inventory/:id/adjust', requireModule('inventory'), async (req, res) => {
  const product = await get('SELECT * FROM products WHERE id = $1', req.params.id)
  if (!product) return fail(res, 404, 'Product not found')
  const delta = Number(req.body?.delta)
  if (!delta || !Number.isInteger(delta)) return fail(res, 400, 'Enter a whole-number quantity to add or remove')
  const next = product.stock + delta
  const allowBackorder = await getSetting('allow_backorder', false)
  if (next < 0 && !allowBackorder) {
    return fail(res, 400, 'Stock cannot go below zero')
  }
  await run('UPDATE products SET stock = $1 WHERE id = $2', next, product.id)
  await run(
    `INSERT INTO inventory_movements (id, product_id, delta, reason, reference_id, note, staff_id, created_at)
     VALUES ($1, $2, $3, 'adjustment', NULL, $4, $5, $6)`,
    id(), product.id, delta, req.body?.note || '', null, nowIso()
  )
  await maybeStockAlert(product, next)
  const updated = await get('SELECT * FROM products WHERE id = $1', product.id)
  res.json(await productRow(updated))
})

app.get('/api/occasions', requireModule('occasions'), async (req, res) => {
  const q = String(req.query.search || '').trim()
  const items = await all(
    `SELECT oc.*,
      (SELECT COUNT(*) FROM orders o WHERE o.occasion_id = oc.id) AS order_count
     FROM occasions oc
     ${q ? 'WHERE oc.name LIKE $1' : ''}
     ORDER BY oc.created_at DESC`,
    ...(q ? [like(q)] : []))
  res.json({ items })
})

app.post('/api/occasions', requireModule('occasions'), async (req, res) => {
  const { name, color } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Occasion name is required')
  const row = { id: id(), name: name.trim(), color: color || '#E56B8A', created_at: nowIso() }
  await run('INSERT INTO occasions (id, name, color, created_at) VALUES ($1, $2, $3, $4)',
    row.id, row.name, row.color, row.created_at)
  res.status(201).json(row)
})

app.put('/api/occasions/:id', requireModule('occasions'), async (req, res) => {
  const existing = await get('SELECT * FROM occasions WHERE id = $1', req.params.id)
  if (!existing) return fail(res, 404, 'Occasion not found')
  const { name, color } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Occasion name is required')
  await run('UPDATE occasions SET name=$1, color=$2 WHERE id=$3', name.trim(), color || existing.color, req.params.id)
  const updated = await get('SELECT * FROM occasions WHERE id = $1', req.params.id)
  res.json(updated)
})

app.delete('/api/occasions/:id', requireModule('occasions'), async (req, res) => {
  const info = await run('DELETE FROM occasions WHERE id = $1', req.params.id)
  if (!info.changes) return fail(res, 404, 'Occasion not found')
  res.json({ ok: true })
})

app.get('/api/vendors', requireModule('vendors'), async (req, res) => {
  const q = String(req.query.search || '').trim()
  const items = await all(
    `SELECT v.*, (SELECT COUNT(*) FROM products p WHERE p.vendor_id = v.id) AS product_count
     FROM vendors v ${q ? 'WHERE v.name LIKE $1 OR v.contact_name LIKE $1 OR v.phone LIKE $1' : ''}
     ORDER BY v.created_at DESC`,
    ...(q ? [like(q)] : []))
  res.json({ items })
})

app.get('/api/vendors/:id', requireModule('vendors'), async (req, res) => {
  const vendor = await get('SELECT * FROM vendors WHERE id = $1', req.params.id)
  if (!vendor) return fail(res, 404, 'Vendor not found')
  const products = await all('SELECT * FROM products WHERE vendor_id = $1', vendor.id)
  const hydratedProducts = []
  for (const p of products) {
    hydratedProducts.push(await productRow(p))
  }
  res.json({ ...vendor, products: hydratedProducts })
})

app.post('/api/vendors', requireModule('vendors'), async (req, res) => {
  const { name, contact_name, phone, email, address, materials, notes } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Vendor name is required')
  const row = {
    id: id(),
    name: name.trim(),
    contact_name: contact_name?.trim() || '',
    phone: phone?.trim() || '',
    email: email?.trim() || '',
    address: address?.trim() || '',
    materials: materials?.trim() || '',
    notes: notes?.trim() || '',
    created_at: nowIso(),
  }
  await run(
    `INSERT INTO vendors (id, name, contact_name, phone, email, address, materials, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    row.id, row.name, row.contact_name, row.phone, row.email, row.address, row.materials, row.notes, row.created_at
  )
  res.status(201).json(row)
})

app.put('/api/vendors/:id', requireModule('vendors'), async (req, res) => {
  const existing = await get('SELECT * FROM vendors WHERE id = $1', req.params.id)
  if (!existing) return fail(res, 404, 'Vendor not found')
  const { name, contact_name, phone, email, address, materials, notes } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Vendor name is required')
  await run(
    `UPDATE vendors SET name=$1, contact_name=$2, phone=$3, email=$4, address=$5, materials=$6, notes=$7 WHERE id=$8`,
    name.trim(), contact_name?.trim() || '', phone?.trim() || '', email?.trim() || '',
    address?.trim() || '', materials?.trim() || '', notes?.trim() || '', req.params.id
  )
  const updated = await get('SELECT * FROM vendors WHERE id = $1', req.params.id)
  res.json(updated)
})

app.delete('/api/vendors/:id', requireModule('vendors'), async (req, res) => {
  await run('UPDATE products SET vendor_id = NULL WHERE vendor_id = $1', req.params.id)
  const info = await run('DELETE FROM vendors WHERE id = $1', req.params.id)
  if (!info.changes) return fail(res, 404, 'Vendor not found')
  res.json({ ok: true })
})

app.get('/api/staff', async (req, res) => {
  const q = String(req.query.search || '').trim()
  const items = await all(
    `SELECT * FROM staff ${q ? 'WHERE name LIKE $1 OR email LIKE $1 OR phone LIKE $1' : ''} ORDER BY created_at DESC`,
    ...(q ? [like(q)] : []))
  res.json({ items: items.map(publicStaff) })
})

app.post('/api/staff', async (req, res) => {
  const { name, email, phone, role, permissions, active } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Staff name is required')
  if (email?.trim()) {
    const exists = await get('SELECT id FROM staff WHERE email = $1', email.trim().toLowerCase())
    if (exists) return fail(res, 400, 'A staff member with this email already exists')
  }
  const rowId = id()
  await run(
    `INSERT INTO staff (id, name, email, phone, password_hash, role, permissions, avatar, active, created_at)
     VALUES ($1, $2, $3, $4, '', $5, $6, '', $7, $8)`,
    rowId, name.trim(), (email || '').trim().toLowerCase(), phone?.trim() || '',
    role || 'florist', JSON.stringify(permissions || []), active === false ? 0 : 1, nowIso()
  )
  const saved = await get('SELECT * FROM staff WHERE id = $1', rowId)
  res.status(201).json(publicStaff(saved))
})

app.put('/api/staff/:id', async (req, res) => {
  const existing = await get('SELECT * FROM staff WHERE id = $1', req.params.id)
  if (!existing) return fail(res, 404, 'Staff member not found')
  const { name, email, phone, role, permissions, active, avatar } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Name is required')
  await run(
    `UPDATE staff SET name=$1, email=$2, phone=$3, role=$4, permissions=$5, avatar=$6, active=$7 WHERE id=$8`,
    name.trim(), (email || existing.email).trim().toLowerCase(), phone?.trim() || '',
    role || existing.role, JSON.stringify(permissions || parseJson(existing.permissions, [])),
    avatar ?? existing.avatar, active === false ? 0 : 1, req.params.id
  )
  const updated = await get('SELECT * FROM staff WHERE id = $1', req.params.id)
  res.json(publicStaff(updated))
})

app.delete('/api/staff/:id', async (req, res) => {
  const existing = await get('SELECT * FROM staff WHERE id = $1', req.params.id)
  if (!existing) return fail(res, 404, 'Staff member not found')
  await run('DELETE FROM sessions WHERE staff_id = $1', req.params.id)
  await run('DELETE FROM staff WHERE id = $1', req.params.id)
  res.json({ ok: true })
})

app.get('/api/orders', requireModule('orders'), async (req, res) => {
  const { page, limit, offset } = paginateQuery(req)
  const q = String(req.query.search || '').trim()
  const status = req.query.status
  const sort = req.query.sort === 'total' ? 'o.total' : 'o.created_at'
  const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC'
  const clauses = []
  const params = []
  if (q) {
    clauses.push('(o.order_number LIKE $' + (params.length + 1) + ' OR c.name LIKE $' + (params.length + 2) + ' OR c.phone LIKE $' + (params.length + 3) + ')')
    params.push(like(q), like(q), like(q))
  }
  if (status) {
    clauses.push('o.status = $' + (params.length + 1))
    params.push(status)
  }
  if (req.query.from && req.query.to) {
    const { fromIso, toIso } = dayBounds(req.query.from, req.query.to)
    clauses.push('o.created_at >= $' + (params.length + 1) + ' AND o.created_at <= $' + (params.length + 2))
    params.push(fromIso, toIso)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const totalRow = await get(
    `SELECT COUNT(*) AS c FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ${where}`, ...params)
  const total = totalRow?.c || 0
  const items = await all(
    `SELECT o.*, c.name AS customer_name FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     ${where} ORDER BY ${sort} ${dir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    ...params, limit, offset)
  const hydratedItems = []
  for (const item of items) {
    hydratedItems.push(await hydrateOrder(item))
  }
  res.json({ items: hydratedItems, total, page, limit, pages: Math.ceil(total / limit) || 1 })
})

app.get('/api/orders/:id', requireModule('orders'), async (req, res) => {
  const order = await get('SELECT * FROM orders WHERE id = $1', req.params.id)
  if (!order) return fail(res, 404, 'Order not found')
  res.json(await hydrateOrder(order))
})

app.post('/api/orders', requireModule('orders'), async (req, res) => {
  try {
    const body = req.body || {}
    const items = await validateItems(body.items)
    const totals = await calcTotals({
      items,
      discount: body.discount,
      discount_type: body.discount_type || 'fixed',
    })
    const status = ORDER_STATUSES.includes(body.status) ? body.status : 'pending'
    const orderId = id()
    const orderNumber = await nextOrderNumber()
    const row = {
      id: orderId,
      order_number: orderNumber,
      customer_id: body.customer_id || null,
      occasion_id: body.occasion_id || null,
      status,
      ...totals,
      discount_type: body.discount_type || 'fixed',
      notes: body.notes?.trim() || '',
      campaign_id: body.campaign_id || null,
      delivery_address: body.delivery_address?.trim() || '',
      delivery_date: body.delivery_date || '',
      delivery_time: body.delivery_time || '',
      delivery_staff_id: body.delivery_staff_id || null,
      delivery_status: body.delivery_status || (body.delivery_date ? 'scheduled' : ''),
      delivery_notes: body.delivery_notes?.trim() || '',
      stock_applied: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    await exec('BEGIN')
    try {
      await run(
        `INSERT INTO orders (
          id, order_number, customer_id, occasion_id, status, subtotal, discount, discount_type, tax, total, notes,
          campaign_id, delivery_address, delivery_date, delivery_time, delivery_staff_id, delivery_status,
          delivery_notes, stock_applied, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21
        )`,
        row.id, row.order_number, row.customer_id, row.occasion_id, row.status, row.subtotal, row.discount, row.discount_type, row.tax, row.total, row.notes,
        row.campaign_id, row.delivery_address, row.delivery_date, row.delivery_time, row.delivery_staff_id, row.delivery_status,
        row.delivery_notes, row.stock_applied, row.created_at, row.updated_at
      )
      for (const item of items) {
        await run(
          `INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          id(), orderId, item.product_id, item.product_name, item.quantity, item.unit_price, item.total
        )
      }
      if (STOCK_STATUSES.has(status)) await applyStock(orderId, 'order_confirm')
      await exec('COMMIT')
    } catch (inner) {
      await exec('ROLLBACK')
      throw inner
    }
    const notifyOrders = await getSetting('notify_orders', true)
    if (notifyOrders) {
      await notify('order', 'New order', `${row.order_number} was created.`, `/orders/${orderId}`)
    }
    const saved = await get('SELECT * FROM orders WHERE id = $1', orderId)
    res.status(201).json(await hydrateOrder(saved))
  } catch (err) {
    return fail(res, 400, err.message)
  }
})

app.put('/api/orders/:id', requireModule('orders'), async (req, res) => {
  try {
    const existing = await get('SELECT * FROM orders WHERE id = $1', req.params.id)
    if (!existing) return fail(res, 404, 'Order not found')
    if (existing.status === 'cancelled') return fail(res, 400, 'Cancelled orders cannot be edited')
    const body = req.body || {}
    const items = await validateItems(body.items)
    const totals = await calcTotals({
      items,
      discount: body.discount,
      discount_type: body.discount_type || existing.discount_type,
    })
    const status = ORDER_STATUSES.includes(body.status) ? body.status : existing.status
    if (existing.stock_applied) await restoreStock(existing.id, 'order_edit')
    await run('DELETE FROM order_items WHERE order_id = $1', existing.id)
    for (const item of items) {
      await run(
        `INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        id(), existing.id, item.product_id, item.product_name, item.quantity, item.unit_price, item.total
      )
    }
    await run(
      `UPDATE orders SET customer_id=$1, occasion_id=$2, status=$3, subtotal=$4, discount=$5, discount_type=$6, tax=$7, total=$8,
       notes=$9, campaign_id=$10, delivery_address=$11, delivery_date=$12, delivery_time=$13, delivery_staff_id=$14,
       delivery_status=$15, delivery_notes=$16, updated_at=$17 WHERE id=$18`,
      body.customer_id || null, body.occasion_id || null, status,
      totals.subtotal, totals.discount, body.discount_type || existing.discount_type,
      totals.tax, totals.total, body.notes?.trim() || '', body.campaign_id || null,
      body.delivery_address?.trim() || '', body.delivery_date || '', body.delivery_time || '',
      body.delivery_staff_id || null, body.delivery_status || existing.delivery_status,
      body.delivery_notes?.trim() || '', nowIso(), existing.id
    )
    if (status === 'cancelled') {
      // already restored
    } else if (STOCK_STATUSES.has(status)) {
      await applyStock(existing.id, 'order_edit')
    }
    const updated = await get('SELECT * FROM orders WHERE id = $1', existing.id)
    res.json(await hydrateOrder(updated))
  } catch (err) {
    return fail(res, 400, err.message)
  }
})

app.patch('/api/orders/:id/status', requireModule('orders'), async (req, res) => {
  try {
    const existing = await get('SELECT * FROM orders WHERE id = $1', req.params.id)
    if (!existing) return fail(res, 404, 'Order not found')
    const status = req.body?.status
    if (!ORDER_STATUSES.includes(status)) return fail(res, 400, 'Invalid status')
    if (status === 'cancelled' && existing.status !== 'cancelled') {
      await restoreStock(existing.id, 'order_cancel')
      await run('UPDATE orders SET status=$1, delivery_status=$2, updated_at=$3 WHERE id=$4',
        'cancelled', existing.delivery_status ? 'cancelled' : '', nowIso(), existing.id)
    } else {
      if (STOCK_STATUSES.has(status) && !existing.stock_applied) await applyStock(existing.id, 'order_confirm')
      if (status === 'pending' && existing.stock_applied) await restoreStock(existing.id, 'order_edit')
      const deliveryMap = {
        out_for_delivery: 'out_for_delivery',
        delivered: 'delivered',
        ready: existing.delivery_status ? 'assigned' : existing.delivery_status,
      }
      const deliveryStatus = deliveryMap[status] ?? existing.delivery_status
      await run('UPDATE orders SET status=$1, delivery_status=$2, updated_at=$3 WHERE id=$4',
        status, deliveryStatus, nowIso(), existing.id)
    }
    const updated = await get('SELECT * FROM orders WHERE id = $1', existing.id)
    res.json(await hydrateOrder(updated))
  } catch (err) {
    return fail(res, 400, err.message)
  }
})

app.post('/api/orders/:id/cancel', requireModule('orders'), async (req, res) => {
  try {
    const existing = await get('SELECT * FROM orders WHERE id = $1', req.params.id)
    if (!existing) return fail(res, 404, 'Order not found')
    if (existing.status === 'cancelled') return fail(res, 400, 'Order is already cancelled')
    await restoreStock(existing.id, 'order_cancel')
    await run('UPDATE orders SET status=$1, delivery_status=$2, updated_at=$3 WHERE id=$4',
      'cancelled', existing.delivery_status ? 'cancelled' : '', nowIso(), existing.id)
    const updated = await get('SELECT * FROM orders WHERE id = $1', existing.id)
    res.json(await hydrateOrder(updated))
  } catch (err) {
    return fail(res, 400, err.message)
  }
})

app.delete('/api/orders/:id', requireModule('orders'), async (req, res) => {
  const existing = await get('SELECT * FROM orders WHERE id = $1', req.params.id)
  if (!existing) return fail(res, 404, 'Order not found')
  if (!['pending', 'cancelled'].includes(existing.status)) {
    return fail(res, 400, 'Only pending or cancelled orders can be deleted')
  }
  if (existing.stock_applied) await restoreStock(existing.id, 'order_cancel')
  await run('DELETE FROM orders WHERE id = $1', existing.id)
  res.json({ ok: true })
})

app.get('/api/deliveries', requireModule('delivery'), async (req, res) => {
  const status = req.query.status
  const q = String(req.query.search || '').trim()
  const clauses = [`(o.delivery_address != '' OR o.delivery_date != '')`, `o.status != 'cancelled'`]
  const params = []
  if (status) {
    clauses.push('o.delivery_status = $' + (params.length + 1))
    params.push(status)
  }
  if (req.query.from && req.query.to) {
    clauses.push('o.delivery_date >= $' + (params.length + 1) + ' AND o.delivery_date <= $' + (params.length + 2))
    params.push(req.query.from, req.query.to)
  } else if (req.query.upcoming === '1') {
    clauses.push(`o.delivery_date >= date('now')`)
  }
  if (q) {
    clauses.push('(o.order_number LIKE $' + (params.length + 1) + ' OR c.name LIKE $' + (params.length + 2) + ' OR o.delivery_address LIKE $' + (params.length + 3) + ')')
    params.push(like(q), like(q), like(q))
  }
  const items = await all(
    `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY o.delivery_date ASC, o.delivery_time ASC`,
    ...params)
  const hydratedItems = []
  for (const item of items) {
    hydratedItems.push(await hydrateOrder(item))
  }
  res.json({ items: hydratedItems })
})

app.patch('/api/deliveries/:id', requireModule('delivery'), async (req, res) => {
  try {
    const existing = await get('SELECT * FROM orders WHERE id = $1', req.params.id)
    if (!existing) return fail(res, 404, 'Delivery not found')
    const { delivery_address, delivery_date, delivery_time, delivery_staff_id, delivery_status, delivery_notes } = req.body || {}
    await run(
      `UPDATE orders SET delivery_address=$1, delivery_date=$2, delivery_time=$3, delivery_staff_id=$4,
       delivery_status=$5, delivery_notes=$6, updated_at=$7 WHERE id=$8`,
      delivery_address ?? existing.delivery_address,
      delivery_date ?? existing.delivery_date,
      delivery_time ?? existing.delivery_time,
      delivery_staff_id ?? existing.delivery_staff_id,
      delivery_status ?? existing.delivery_status,
      delivery_notes ?? existing.delivery_notes,
      nowIso(),
      existing.id
    )
    if (delivery_status) await syncDeliveryStatus(existing.id, delivery_status)
    const updated = await get('SELECT * FROM orders WHERE id = $1', existing.id)
    res.json(await hydrateOrder(updated))
  } catch (err) {
    return fail(res, 400, err.message)
  }
})

app.get('/api/campaigns', requireModule('marketing'), async (req, res) => {
  const q = String(req.query.search || '').trim()
  const items = await all(
    `SELECT * FROM campaigns ${q ? 'WHERE name LIKE $1 OR code LIKE $1' : ''} ORDER BY created_at DESC`,
    ...(q ? [like(q)] : []))
  res.json({
    items: items.map((c) => ({ ...c, featured_product_ids: parseJson(c.featured_product_ids, []) })),
  })
})

app.post('/api/campaigns', requireModule('marketing'), async (req, res) => {
  const { name, type, description, discount_type, discount_value, code, start_date, end_date, status, featured_product_ids } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Campaign name is required')
  const row = {
    id: id(),
    name: name.trim(),
    type: type || 'promotion',
    description: description?.trim() || '',
    discount_type: discount_type || 'percent',
    discount_value: Number(discount_value) || 0,
    code: code?.trim() || '',
    start_date: start_date || '',
    end_date: end_date || '',
    status: status || 'draft',
    featured_product_ids: JSON.stringify(featured_product_ids || []),
    created_at: nowIso(),
  }
  await run(
    `INSERT INTO campaigns (id, name, type, description, discount_type, discount_value, code, start_date, end_date, status, featured_product_ids, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    row.id, row.name, row.type, row.description, row.discount_type, row.discount_value, row.code, row.start_date, row.end_date, row.status, row.featured_product_ids, row.created_at
  )
  res.status(201).json({ ...row, featured_product_ids: featured_product_ids || [] })
})

app.put('/api/campaigns/:id', requireModule('marketing'), async (req, res) => {
  const existing = await get('SELECT * FROM campaigns WHERE id = $1', req.params.id)
  if (!existing) return fail(res, 404, 'Campaign not found')
  const { name, type, description, discount_type, discount_value, code, start_date, end_date, status, featured_product_ids } = req.body || {}
  if (!name?.trim()) return fail(res, 400, 'Campaign name is required')
  await run(
    `UPDATE campaigns SET name=$1, type=$2, description=$3, discount_type=$4, discount_value=$5, code=$6, start_date=$7, end_date=$8, status=$9, featured_product_ids=$10 WHERE id=$11`,
    name.trim(), type || existing.type, description?.trim() || '', discount_type || existing.discount_type,
    Number(discount_value) || 0, code?.trim() || '', start_date || '', end_date || '',
    status || existing.status, JSON.stringify(featured_product_ids || []), req.params.id
  )
  const saved = await get('SELECT * FROM campaigns WHERE id = $1', req.params.id)
  res.json({ ...saved, featured_product_ids: parseJson(saved.featured_product_ids, []) })
})

app.delete('/api/campaigns/:id', requireModule('marketing'), async (req, res) => {
  const info = await run('DELETE FROM campaigns WHERE id = $1', req.params.id)
  if (!info.changes) return fail(res, 404, 'Campaign not found')
  res.json({ ok: true })
})

function reportRange(req) {
  return dayBounds(req.query.from, req.query.to)
}

app.get('/api/reports/:type', requireModule('reports'), async (req, res) => {
  const { fromIso, toIso } = reportRange(req)
  const type = req.params.type
  if (type === 'sales' || type === 'revenue' || type === 'orders') {
    const orders = await all(
      `SELECT o.*, c.name AS customer_name FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.created_at >= $1 AND o.created_at <= $2
       ORDER BY o.created_at DESC`, fromIso, toIso)
    const hydratedOrders = []
    for (const o of orders) {
      hydratedOrders.push(await hydrateOrder(o))
    }
    const paid = hydratedOrders.filter((o) => o.status !== 'cancelled')
    const revenue = paid.reduce((s, o) => s + Number(o.total), 0)
    res.json({
      summary: {
        orders: hydratedOrders.length,
        revenue: Number(revenue.toFixed(2)),
        average: paid.length ? Number((revenue / paid.length).toFixed(2)) : 0,
      },
      items: hydratedOrders,
    })
    return
  }
  if (type === 'products' || type === 'performance') {
    const items = await all(
      `SELECT oi.product_id, oi.product_name, SUM(oi.quantity) AS sold, SUM(oi.total) AS revenue, p.stock, p.image
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.created_at >= $1 AND o.created_at <= $2 AND o.status != 'cancelled'
       GROUP BY oi.product_id, oi.product_name, p.stock, p.image
       ORDER BY sold DESC`, fromIso, toIso)
    res.json({ items })
    return
  }
  if (type === 'customers') {
    const items = await all(
      `SELECT c.*, COUNT(o.id) AS order_count, COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END), 0) AS spent
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id AND o.created_at >= $1 AND o.created_at <= $2
       GROUP BY c.id
       HAVING order_count > 0
       ORDER BY spent DESC`, fromIso, toIso)
    res.json({ items })
    return
  }
  if (type === 'inventory' || type === 'low-stock') {
    const items = await all(
      type === 'low-stock'
        ? 'SELECT * FROM products WHERE stock <= low_stock_threshold ORDER BY stock ASC'
        : 'SELECT * FROM products ORDER BY name')
    const hydratedItems = []
    for (const item of items) {
      hydratedItems.push(await productRow(item))
    }
    res.json({ items: hydratedItems })
    return
  }
  if (type === 'occasions') {
    const items = await all(
      `SELECT oc.*, COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS revenue
       FROM occasions oc
       LEFT JOIN orders o ON o.occasion_id = oc.id AND o.created_at >= $1 AND o.created_at <= $2 AND o.status != 'cancelled'
       GROUP BY oc.id
       ORDER BY order_count DESC`, fromIso, toIso)
    res.json({ items })
    return
  }
  return fail(res, 404, 'Unknown report')
})

app.get('/api/reports/:type/export', requireModule('reports'), async (req, res) => {
  const { fromIso, toIso } = reportRange(req)
  const type = req.params.type
  let headers = []
  let rows = []
  if (['sales', 'revenue', 'orders'].includes(type)) {
    headers = ['Order', 'Customer', 'Status', 'Total', 'Date']
    const orders = await all(
      `SELECT o.order_number, c.name AS customer_name, o.status, o.total, o.created_at
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.created_at >= $1 AND o.created_at <= $2 ORDER BY o.created_at DESC`, fromIso, toIso)
    rows = orders.map((r) => [r.order_number, r.customer_name || '', r.status, r.total, r.created_at])
  } else if (type === 'products' || type === 'performance') {
    headers = ['Product', 'Sold', 'Revenue']
    const items = await all(
      `SELECT oi.product_name, SUM(oi.quantity) AS sold, SUM(oi.total) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.created_at >= $1 AND o.created_at <= $2 AND o.status != 'cancelled'
       GROUP BY oi.product_id, oi.product_name ORDER BY sold DESC`, fromIso, toIso)
    rows = items.map((r) => [r.product_name, r.sold, r.revenue])
  } else if (type === 'customers') {
    headers = ['Customer', 'Phone', 'Orders', 'Spent']
    const items = await all(
      `SELECT c.name, c.phone, COUNT(o.id) AS order_count, COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END), 0) AS spent
       FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.created_at >= $1 AND o.created_at <= $2
       GROUP BY c.id HAVING order_count > 0 ORDER BY spent DESC`, fromIso, toIso)
    rows = items.map((r) => [r.name, r.phone, r.order_count, r.spent])
  } else if (type === 'inventory' || type === 'low-stock') {
    headers = ['Product', 'Stock', 'Threshold', 'Price']
    const sql = type === 'low-stock'
      ? 'SELECT name, stock, low_stock_threshold, price FROM products WHERE stock <= low_stock_threshold ORDER BY stock'
      : 'SELECT name, stock, low_stock_threshold, price FROM products ORDER BY name'
    const items = await all(sql)
    rows = items.map((r) => [r.name, r.stock, r.low_stock_threshold, r.price])
  } else if (type === 'occasions') {
    headers = ['Occasion', 'Orders', 'Revenue']
    const items = await all(
      `SELECT oc.name, COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS revenue
       FROM occasions oc LEFT JOIN orders o ON o.occasion_id = oc.id AND o.created_at >= $1 AND o.created_at <= $2 AND o.status != 'cancelled'
       GROUP BY oc.id ORDER BY order_count DESC`, fromIso, toIso)
    rows = items.map((r) => [r.name, r.order_count, r.revenue])
  } else {
    return fail(res, 404, 'Unknown report')
  }
  const csv = [headers, ...rows]
    .map((line) => line.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`)
  res.send(csv)
})

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return fail(res, 400, err.message)
  console.error(err)
  return fail(res, 500, err.message || 'Server error')
})

const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

// Initialize database on startup
initDb().catch((err) => {
  console.error('Database initialization failed:', err)
})

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`SportsEra API running on http://127.0.0.1:${PORT}`)
  })
}

export default app
