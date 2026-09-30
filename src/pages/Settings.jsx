import { useState, useEffect } from 'react'
import { Upload, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { api, upload } from '../api'
import { useApp } from '../context'
import { Field, inputClass } from '../components/ui'
import { Header } from './Customers'

export function SettingsPage() {
  const { settings, setSettings, toast, refreshMe } = useApp()
  const [form, setForm] = useState({
    shop_name: settings.shop_name || 'RiSports',
    shop_tagline: settings.shop_tagline || 'Sports Equipment & Apparel',
    logo: settings.logo || '',
    email: settings.email || '',
    phone: settings.phone || '',
    address: settings.address || '',
    currency: settings.currency || 'USD',
    currency_symbol: settings.currency_symbol || '$',
    tax_rate: settings.tax_rate ?? 0,
    order_prefix: settings.order_prefix || 'ORD',
    allow_backorder: Boolean(settings.allow_backorder),
    low_stock_notify: settings.low_stock_notify !== false,
    notify_orders: settings.notify_orders !== false,
    notify_inventory: settings.notify_inventory !== false,
  })

  const [busy, setBusy] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [storageConfigured, setStorageConfigured] = useState(true)

  useEffect(() => {
    setForm({
      shop_name: settings.shop_name || 'RiSports',
      shop_tagline: settings.shop_tagline || 'Sports Equipment & Apparel',
      logo: settings.logo || '',
      email: settings.email || '',
      phone: settings.phone || '',
      address: settings.address || '',
      currency: settings.currency || 'USD',
      currency_symbol: settings.currency_symbol || '$',
      tax_rate: settings.tax_rate ?? 0,
      order_prefix: settings.order_prefix || 'ORD',
      allow_backorder: Boolean(settings.allow_backorder),
      low_stock_notify: settings.low_stock_notify !== false,
      notify_orders: settings.notify_orders !== false,
      notify_inventory: settings.notify_inventory !== false,
    })
  }, [settings])

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
      toast('Settings saved successfully')
    } catch (err) {
      toast(err.message || 'Failed to save settings', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast('Only PNG, JPG, and WebP images are allowed', 'error')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be smaller than 5 MB', 'error')
      e.target.value = ''
      return
    }

    setLogoBusy(true)
    try {
      const res = await upload('/settings/logo', file, 'logo')
      setSettings(res.settings)
      setForm((f) => ({ ...f, logo: res.logo }))
      toast('Logo updated successfully')
    } catch (err) {
      toast(err.message || 'Failed to upload logo', 'error')
    } finally {
      setLogoBusy(false)
      e.target.value = ''
    }
  }

  const resetLogoToDefault = async () => {
    setForm((f) => ({ ...f, logo: '' }))
    try {
      const next = await api('/settings', { method: 'PUT', body: { logo: '' } })
      setSettings(next)
      toast('Logo reset to default risports.png')
    } catch (err) {
      toast(err.message || 'Failed to reset logo', 'error')
    }
  }

  const effectiveLogo = form.logo || '/risports.png'

  return (
    <div className="space-y-5 max-w-3xl">
      <Header title="Store Settings" subtitle="Configure RiSports branding, logo, and POS preferences" />

      {/* Blob Token Notice if not configured */}
      {!storageConfigured && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-400">Vercel Blob Storage Notice</p>
            <p className="mt-1 text-[#A3A3A3] leading-relaxed">
              To enable image and logo uploads on Vercel, add <code className="font-mono bg-[#1A1A1A] border border-[#3A3A3A] text-amber-300 px-1.5 py-0.5 rounded text-xs">BLOB_READ_WRITE_TOKEN</code> to your Vercel Project Environment Variables. The app uses the permanent default logo <code className="font-mono bg-[#1A1A1A] border border-[#3A3A3A] text-white px-1.5 py-0.5 rounded text-xs">/risports.png</code> until set.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={save} className="card p-5 sm:p-7 space-y-6">
        {/* Branding & Logo Section */}
        <div className="space-y-3 pb-5 border-b border-[#3A3A3A]">
          <h2 className="text-base font-bold text-white">Store Logo & Branding</h2>
          <p className="text-xs text-[#A3A3A3]">
            Default logo is <code className="text-orange-400">risports.png</code>. You can upload a custom logo or provide a URL anytime.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
            <div className="w-20 h-20 rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] overflow-hidden flex items-center justify-center shrink-0 p-2 shadow-inner">
              <img
                src={effectiveLogo}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  if (e.currentTarget.src !== window.location.origin + '/risports.png') {
                    e.currentTarget.src = '/risports.png'
                  }
                }}
              />
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer transition-colors shadow">
                  <Upload size={14} />
                  <span>{logoBusy ? 'Uploading…' : 'Upload New Logo'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={logoBusy}
                    onChange={handleLogoUpload}
                  />
                </label>

                {form.logo && (
                  <button
                    type="button"
                    onClick={resetLogoToDefault}
                    className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] hover:bg-[#262626] text-[#A3A3A3] hover:text-white text-xs font-semibold transition-colors"
                  >
                    <RotateCcw size={14} />
                    <span>Reset to Default Logo</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-[#A3A3A3]">
                {form.logo ? 'Using custom logo.' : 'Currently using default risports.png'}
              </p>
            </div>
          </div>

          <Field label="Custom Logo URL (Optional)">
            <input
              className={inputClass}
              placeholder="https://example.com/logo.png (or leave blank to use risports.png)"
              value={form.logo}
              onChange={(e) => setForm({ ...form, logo: e.target.value })}
            />
          </Field>
        </div>

        {/* General Shop Info */}
        <div className="space-y-3 pb-5 border-b border-[#3A3A3A]">
          <h2 className="text-base font-bold text-white">Shop Profile</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Shop Name">
              <input
                className={inputClass}
                placeholder="RiSports"
                value={form.shop_name}
                onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              />
            </Field>
            <Field label="Shop Tagline">
              <input
                className={inputClass}
                placeholder="Sports Equipment & Apparel"
                value={form.shop_tagline}
                onChange={(e) => setForm({ ...form, shop_tagline: e.target.value })}
              />
            </Field>
            <Field label="Contact Email">
              <input
                type="email"
                className={inputClass}
                placeholder="contact@risports.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Contact Phone">
              <input
                className={inputClass}
                placeholder="+1 555-0199"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Store Address">
            <input
              className={inputClass}
              placeholder="123 RiSports Blvd, Suite 100"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
        </div>

        {/* Financial & Order Settings */}
        <div className="space-y-3 pb-5 border-b border-[#3A3A3A]">
          <h2 className="text-base font-bold text-white">POS & Order Preferences</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Currency Code">
              <input
                className={inputClass}
                placeholder="USD"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </Field>
            <Field label="Currency Symbol">
              <input
                className={inputClass}
                placeholder="$"
                value={form.currency_symbol}
                onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
              />
            </Field>
            <Field label="Default Tax Rate %">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                placeholder="0"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Order Number Prefix">
            <input
              className={inputClass}
              placeholder="ORD"
              value={form.order_prefix}
              onChange={(e) => setForm({ ...form, order_prefix: e.target.value })}
            />
          </Field>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#F97316] w-4 h-4 rounded"
                checked={form.allow_backorder}
                onChange={(e) => setForm({ ...form, allow_backorder: e.target.checked })}
              />
              <span>Allow selling products when out of stock (Backorders)</span>
            </label>

            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#F97316] w-4 h-4 rounded"
                checked={form.low_stock_notify}
                onChange={(e) => setForm({ ...form, low_stock_notify: e.target.checked })}
              />
              <span>Low-stock alerts in header notifications</span>
            </label>

            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#F97316] w-4 h-4 rounded"
                checked={form.notify_orders}
                onChange={(e) => setForm({ ...form, notify_orders: e.target.checked })}
              />
              <span>New order creation notifications</span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={busy}
            className="h-11 px-6 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-sm disabled:opacity-50 transition-colors shadow-lg w-full sm:w-auto"
          >
            {busy ? 'Saving Changes…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
