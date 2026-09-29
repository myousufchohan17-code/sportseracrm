import { Printer } from 'lucide-react'
import { formatDate, formatDateTime, money } from '../utils'

function shopBits(settings = {}) {
  return {
    name: settings.shop_name || 'SportsEra Sports Shop CRM',
    tagline: settings.shop_tagline || 'Sports Shop CRM',
    phone: settings.phone || '',
    email: settings.email || '',
    address: settings.address || '',
    logo: settings.logo || '',
    symbol: settings.currency_symbol || '$',
  }
}

export function ReceiptDocument({ order, settings }) {
  const shop = shopBits(settings)
  const customer = order?.customer
  const items = order?.items || []

  return (
    <div className="w-[300px] max-w-full mx-auto bg-white text-ink font-sans text-[12px] leading-snug">
      <div className="text-center border-b border-dashed border-line pb-3">
        {shop.logo ? (
          <img src={shop.logo} alt="" className="w-10 h-10 rounded-xl object-cover mx-auto mb-1.5" />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-bloom text-white grid place-items-center mx-auto mb-1.5 text-sm font-bold">S</div>
        )}
        <h2 className="text-base font-bold tracking-tight">{shop.name}</h2>
        <p className="text-[11px] text-muted">{shop.tagline}</p>
        {shop.address && <p className="text-[11px] text-muted mt-0.5">{shop.address}</p>}
        <p className="text-[11px] text-muted">{[shop.phone, shop.email].filter(Boolean).join(' · ')}</p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-bloom">Receipt</p>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-2 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">Receipt no.</p>
          <p className="font-bold text-[12px]">{order?.order_number}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted">Date</p>
          <p className="font-medium text-[12px]">{formatDateTime(order?.created_at)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">Customer</p>
          <p className="font-medium text-[12px]">{customer?.name || 'Walk-in customer'}</p>
          {customer?.phone && <p className="text-[11px] text-muted">{customer.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted">Status</p>
          <p className="font-medium capitalize text-[12px]">{String(order?.status || '').replaceAll('_', ' ')}</p>
        </div>
      </div>

      {order?.occasion?.name && (
        <p className="text-[11px] mb-2">Occasion: <span className="font-semibold">{order.occasion.name}</span></p>
      )}

      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-y border-line text-[10px] uppercase tracking-wide text-muted">
            <th className="text-left py-1.5 font-semibold">Item</th>
            <th className="text-center py-1.5 font-semibold">Qty</th>
            <th className="text-right py-1.5 font-semibold">Price</th>
            <th className="text-right py-1.5 font-semibold">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id || item.product_id} className="border-b border-line/70">
              <td className="py-1.5 pr-1 align-top break-words">{item.product_name}</td>
              <td className="py-1.5 text-center align-top">{item.quantity}</td>
              <td className="py-1.5 text-right align-top whitespace-nowrap">{money(item.unit_price, shop.symbol)}</td>
              <td className="py-1.5 text-right font-medium align-top whitespace-nowrap">{money(item.total ?? item.quantity * item.unit_price, shop.symbol)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-0.5 text-[12px]">
        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{money(order?.subtotal, shop.symbol)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Discount</span><span>- {money(order?.discount, shop.symbol)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Tax</span><span>{money(order?.tax, shop.symbol)}</span></div>
        <div className="flex justify-between pt-1.5 mt-1.5 border-t-2 border-ink font-bold text-[13px]">
          <span>Total</span>
          <span>{money(order?.total, shop.symbol)}</span>
        </div>
      </div>

      {(order?.delivery_address || order?.delivery_date) && (
        <div className="mt-3 pt-2 border-t border-dashed border-line text-[11px]">
          <p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">Delivery</p>
          {order.delivery_address && <p>{order.delivery_address}</p>}
          {(order.delivery_date || order.delivery_time) && (
            <p className="text-muted mt-0.5">{[formatDate(order.delivery_date), order.delivery_time].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      )}

      {order?.notes && (
        <div className="mt-2 text-[11px]">
          <p className="text-[10px] uppercase tracking-wide text-muted">Notes</p>
          <p>{order.notes}</p>
        </div>
      )}

      <p className="text-center text-[11px] text-muted mt-4">Thank you for blooming with us.</p>
    </div>
  )
}

export function printReceipt(order, settings) {
  const shop = shopBits(settings)
  const customer = order?.customer
  const items = order?.items || []
  const rows = items.map((item) => `
    <tr>
      <td>${esc(item.product_name)}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${money(item.unit_price, shop.symbol)}</td>
      <td style="text-align:right">${money(item.total ?? item.quantity * item.unit_price, shop.symbol)}</td>
    </tr>`).join('')

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${esc(order?.order_number || '')}</title>
  <style>
    body { font-family: "Plus Jakarta Sans", Arial, sans-serif; color: #2c2428; margin: 0; background: #fff; }
    .sheet { width: 300px; max-width: 100%; margin: 0 auto; padding: 16px 14px; font-size: 12px; }
    h1 { margin: 4px 0 0; font-size: 16px; }
    .muted { color: #8d8086; font-size: 11px; }
    .label { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: #8d8086; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #8d8086; border-top: 1px solid #f0e6ea; border-bottom: 1px solid #f0e6ea; padding: 6px 0; text-align: left; }
    td { padding: 6px 0; border-bottom: 1px solid #f7f0f2; font-size: 11px; vertical-align: top; }
    .total { display: flex; justify-content: space-between; font-weight: 800; font-size: 13px; border-top: 2px solid #2c2428; padding-top: 8px; margin-top: 8px; }
    .center { text-align: center; }
    .bloom { color: #dc2626; font-weight: 800; letter-spacing: .18em; font-size: 10px; text-transform: uppercase; margin-top: 8px; }
    img.logo { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; }
    @media print {
      @page { size: 80mm auto; margin: 6mm; }
      body { margin: 0; }
      .sheet { width: 68mm; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="center" style="border-bottom:1px dashed #f0e6ea;padding-bottom:16px">
      ${shop.logo ? `<img class="logo" src="${esc(window.location.origin + shop.logo)}" />` : ''}
      <h1>${esc(shop.name)}</h1>
      <div class="muted">${esc(shop.tagline)}</div>
      <div class="muted">${esc(shop.address)}</div>
      <div class="muted">${esc([shop.phone, shop.email].filter(Boolean).join(' · '))}</div>
      <div class="bloom">Receipt</div>
    </div>
    <table style="margin-top:16px">
      <tr>
        <td><div class="label">Receipt no.</div><strong>${esc(order?.order_number)}</strong></td>
        <td style="text-align:right"><div class="label">Date</div>${esc(formatDateTime(order?.created_at))}</td>
      </tr>
      <tr>
        <td><div class="label">Customer</div>${esc(customer?.name || 'Walk-in customer')}${customer?.phone ? `<div class="muted">${esc(customer.phone)}</div>` : ''}</td>
        <td style="text-align:right"><div class="label">Status</div>${esc(String(order?.status || '').replaceAll('_', ' '))}</td>
      </tr>
    </table>
    ${order?.occasion?.name ? `<p>Occasion: <strong>${esc(order.occasion.name)}</strong></p>` : ''}
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:16px;font-size:13px">
      <div style="display:flex;justify-content:space-between"><span class="muted">Subtotal</span><span>${money(order?.subtotal, shop.symbol)}</span></div>
      <div style="display:flex;justify-content:space-between"><span class="muted">Discount</span><span>- ${money(order?.discount, shop.symbol)}</span></div>
      <div style="display:flex;justify-content:space-between"><span class="muted">Tax</span><span>${money(order?.tax, shop.symbol)}</span></div>
      <div class="total"><span>Total</span><span>${money(order?.total, shop.symbol)}</span></div>
    </div>
    ${order?.delivery_address || order?.delivery_date ? `
      <div style="margin-top:18px;border-top:1px dashed #f0e6ea;padding-top:12px">
        <div class="label">Delivery</div>
        <div>${esc(order.delivery_address || '')}</div>
        <div class="muted">${esc([order.delivery_date, order.delivery_time].filter(Boolean).join(' · '))}</div>
      </div>` : ''}
    ${order?.notes ? `<div style="margin-top:12px"><div class="label">Notes</div>${esc(order.notes)}</div>` : ''}
    <p class="center muted" style="margin-top:28px">Thank you for blooming with us.</p>
  </div>
  <script>window.onload = function () { window.focus(); window.print(); }<\/script>
</body>
</html>`

  const popup = window.open('', 'sports-receipt', 'width=380,height=760')
  if (!popup) return false
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  return true
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function ReceiptActions({ onPrint, onClose }) {
  return (
    <div className="form-actions mt-4">
      {onClose && (
        <button type="button" onClick={onClose} className="h-9 px-3 rounded-xl border border-line text-sm font-semibold">Close</button>
      )}
      <button type="button" onClick={onPrint} className="h-9 px-3 rounded-xl bg-bloom text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
        <Printer size={16} /> Print / Save PDF
      </button>
    </div>
  )
}
