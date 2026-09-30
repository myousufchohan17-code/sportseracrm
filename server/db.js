import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_9yPY6RvIzdHD@ep-ancient-hat-b448zaqo-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
  max: 10,
})

// Helper to convert ? placeholders to $1, $2, ... for PostgreSQL
function convertPlaceholders(sql) {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

// Helper to run a query and return all rows
async function all(sql, ...params) {
  const result = await pool.query(convertPlaceholders(sql), params)
  return result.rows
}

// Helper to run a query and return the first row
async function get(sql, ...params) {
  const result = await pool.query(convertPlaceholders(sql), params)
  return result.rows[0]
}

// Helper to run a query and return the result info
async function run(sql, ...params) {
  const result = await pool.query(convertPlaceholders(sql), params)
  return { changes: result.rowCount }
}

// Helper to execute raw SQL (no params)
async function exec(sql) {
  await pool.query(sql)
}

export { pool, all, get, run, exec }

// In-memory settings cache for synchronous access
let settingsCache = {}

export async function loadSettings() {
  const rows = await all('SELECT key, value FROM settings')
  settingsCache = {}
  for (const row of rows) {
    try {
      settingsCache[row.key] = JSON.parse(row.value)
    } catch {
      settingsCache[row.key] = row.value
    }
  }
  return settingsCache
}

// Initialize database schema
export async function initDb() {
  await exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'florist',
      permissions TEXT DEFAULT '[]',
      avatar TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category_id TEXT,
      vendor_id TEXT,
      price REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      image TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      reference_id TEXT,
      note TEXT DEFAULT '',
      staff_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS occasions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#E56B8A',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      materials TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      customer_id TEXT,
      occasion_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      discount_type TEXT DEFAULT 'fixed',
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      campaign_id TEXT,
      delivery_address TEXT DEFAULT '',
      delivery_date TEXT DEFAULT '',
      delivery_time TEXT DEFAULT '',
      delivery_staff_id TEXT,
      delivery_status TEXT DEFAULT '',
      delivery_notes TEXT DEFAULT '',
      stock_applied INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'promotion',
      description TEXT DEFAULT '',
      discount_type TEXT DEFAULT 'percent',
      discount_value REAL NOT NULL DEFAULT 0,
      code TEXT DEFAULT '',
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      featured_product_ids TEXT DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT DEFAULT '',
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `)

  // Migrate schema for order_items snapshot image column
  try {
    await exec(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image TEXT DEFAULT ''`)
  } catch (err) {
    console.error('Migration note:', err.message)
  }

  const defaultSettings = {
    shop_name: 'RiSports',
    shop_tagline: 'Sports Equipment & Apparel',
    logo: '',
    email: '',
    phone: '',
    address: '',
    currency: 'USD',
    currency_symbol: '$',
    tax_rate: 0,
    allow_backorder: false,
    low_stock_notify: true,
    order_prefix: 'ORD',
    next_order_seq: 1,
    notify_orders: true,
    notify_inventory: true,
  }

  for (const [key, value] of Object.entries(defaultSettings)) {
    await run(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      key,
      JSON.stringify(value)
    )
  }

  await loadSettings()

  const shopName = String((await getSetting('shop_name')) || '')
  const shopTagline = String((await getSetting('shop_tagline')) || '')
  if (
    !shopName ||
    /^sports$/i.test(shopName.trim()) ||
    /sportsera/i.test(shopName) ||
    /flower/i.test(shopName)
  ) {
    await setSetting('shop_name', 'RiSports')
  }
  if (!shopTagline || /flower/i.test(shopTagline) || /sports shop/i.test(shopTagline)) {
    await setSetting('shop_tagline', 'Sports Equipment & Apparel')
  }
}

export function nowIso() {
  return new Date().toISOString()
}

export function id() {
  return crypto.randomUUID()
}

export async function getSetting(key, fallback = null) {
  if (key in settingsCache) {
    return settingsCache[key]
  }
  const row = await get('SELECT value FROM settings WHERE key = $1', key)
  if (!row) return fallback
  try {
    const parsed = JSON.parse(row.value)
    settingsCache[key] = parsed
    return parsed
  } catch {
    settingsCache[key] = row.value
    return row.value
  }
}

export async function setSetting(key, value) {
  settingsCache[key] = value
  await run(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    key,
    JSON.stringify(value)
  )
}

export async function getSettings() {
  return { ...settingsCache }
}

export function parseJson(value, fallback) {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function dayBounds(from, to) {
  const start = from ? new Date(`${from}T00:00:00.000`) : new Date(0)
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date()
  return { fromIso: start.toISOString(), toIso: end.toISOString() }
}

export function previousPeriod(from, to) {
  const start = from ? new Date(`${from}T00:00:00.000`) : new Date(0)
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date()
  const span = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - span)
  return { fromIso: prevStart.toISOString(), toIso: prevEnd.toISOString() }
}

export function changePct(current, previous) {
  if (!previous) return current ? 100 : 0
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

export async function nextOrderNumber() {
  const prefix = (await getSetting('order_prefix', 'ORD')) || 'ORD'
  const seq = Number((await getSetting('next_order_seq', 1))) || 1
  await setSetting('next_order_seq', seq + 1)
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

export async function notify(type, title, message, link = '') {
  await run(
    `INSERT INTO notifications (id, type, title, message, link, read, created_at)
     VALUES ($1, $2, $3, $4, $5, 0, $6)`,
    id(), type, title, message, link, nowIso()
  )
}

export function publicStaff(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    permissions: parseJson(row.permissions, []),
    avatar: row.avatar,
    active: Boolean(row.active),
    created_at: row.created_at,
  }
}
