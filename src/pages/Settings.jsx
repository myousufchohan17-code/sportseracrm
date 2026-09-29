import { useState, useEffect } from 'react'
import { api, upload } from '../api'
import { useApp } from '../context'
import { Field, inputClass } from '../components/ui'
import { Header } from './Customers'

export function SettingsPage() {
  const { settings, setSettings, toast, refreshMe } = useApp()
  const [form, setForm] = useState({
    shop_name: settings.shop_name || '',
    shop_tagline: settings.shop_tagline || '',
    email: settings.email || '',
    phone: settings.phone || '',
    address: settings.address || '',
    currency: settings.currency || 'USD',
    currency_symbol: settings.currency_symbol || '$',
    tax_rate: settings.tax_rate || 0,
    order_prefix: settings.order_prefix || 'ORD',
    allow_backorder: Boolean(settings.allow_backorder),
    low_stock_notify: settings.low_stock_notify !== false,
    notify_orders: settings.notify_orders !== false,
    notify_inventory: settings.notify_inventory !== false,
  })
  const [busy, setBusy] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [storageConfigured, setStorageConfigured] = useState(true)
  const [storageDismissed, setStorageDismissed] = useState(false)

  useEffect(() => {
    api('/health')
      .then((data) => setStorageConfigured(data.blobStorageConfigured !== false))
      .catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const next = await api('/settings', { method: 'PUT', body: form })
      setSettings(next)
      await refreshMe()
      toast('Settings saved')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Header title="Settings" subtitle="Shop details persist after refresh" />
      {!storageConfigured && !storageDismissed && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-start justify-between gap-3">
          <div className="text-sm">
            <p className="font-semibold text-rose-600">Storage not configured</p>
            <p className="mt-1 text-rose-500">
              Set the <code className="font-mono bg-rose-100 px-1.5 py-0.5 rounded">BLOB_READ_WRITE_TOKEN</code> environment variable in your Vercel project settings to enable logo uploads.
            </p>
          </div>
          <button onClick={() => setStorageDismissed(true)} className="text-rose-300 hover:text-rose-500 font-bold text-lg leading-none shrink-0" aria-label="Dismiss">&times;</button>
        </div>
      )}
      <form onSubmit={save} className="card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-4">
          {settings.logo ? <img src={settings.logo} alt="" className="w-16 h-16 rounded-2xl object-cover" /> : <div className="w-16 h-16 rounded-2xl bg-blush" />}
          <label className="text-sm font-semibold text-bloom cursor-pointer">
            {logoBusy ? 'Uploading…' : 'Upload logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
              if (!allowedTypes.includes(file.type)) {
                toast('Only PNG, JPG, and WebP images are allowed', 'error')
                e.target.value = ''
                return
              }
              if (file.size > 5 * 1024 * 1024) {
                toast('Image must be smaller than 5MB', 'error')
                e.target.value = ''
                return
              }
              setLogoBusy(true)
              try {
                const res = await upload('/settings/logo', file, 'logo')
                setSettings(res.settings)
                toast('Logo updated')
              } catch (err) { toast(err.message, 'error') }
              finally { setLogoBusy(false); e.target.value = '' }
            }} />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Shop name"><input className={inputClass} placeholder="SportsEra Sports Shop CRM" value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} /></Field>
          <Field label="Tagline"><input className={inputClass} placeholder="Sports Shop CRM" value={form.shop_tagline} onChange={(e) => setForm({ ...form, shop_tagline: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <Field label="Address"><input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Currency code"><input className={inputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          <Field label="Currency symbol"><input className={inputClass} value={form.currency_symbol} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} /></Field>
          <Field label="Tax rate %"><input type="number" min="0" step="0.01" className={inputClass} value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></Field>
        </div>
        <Field label="Order prefix"><input className={inputClass} value={form.order_prefix} onChange={(e) => setForm({ ...form, order_prefix: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allow_backorder} onChange={(e) => setForm({ ...form, allow_backorder: e.target.checked })} /> Allow selling more than available stock</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.low_stock_notify} onChange={(e) => setForm({ ...form, low_stock_notify: e.target.checked })} /> Low-stock notifications</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notify_orders} onChange={(e) => setForm({ ...form, notify_orders: e.target.checked })} /> New-order notifications</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notify_inventory} onChange={(e) => setForm({ ...form, notify_inventory: e.target.checked })} /> Inventory notifications</label>
        <button disabled={busy} className="h-11 px-5 rounded-2xl bg-bloom text-white font-semibold disabled:opacity-60 w-full sm:w-auto">{busy ? 'Saving…' : 'Save settings'}</button>
      </form>
    </div>
  )
}
