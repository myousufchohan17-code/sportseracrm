import { Printer } from 'lucide-react'
import { formatDate, formatDateTime, money } from '../utils'

function shopBits(settings = {}) {
  const defaultLogo = '/risports.png'
  return {
    name: settings.shop_name || 'RiSports',
    tagline: settings.shop_tagline || 'Sports Equipment & Apparel',
    phone: settings.phone || '',
    email: settings.email || '',
    address: settings.address || '',
    logo: settings.logo || defaultLogo,
    symbol: settings.currency_symbol || '$',
  }
}

export function ReceiptDocument({ order, settings }) {
  const shop = shopBits(settings)
  const customer = order?.customer
  const items = order?.items || []

  return (
    <div className="w-[300px] max-w-full mx-auto bg-white text-zinc-900 font-sans text-[12px] leading-snug p-4 rounded-xl shadow-inner border border-zinc-200">
      <div className="text-center border-b border-dashed border-zinc-300 pb-3">
        <div className="w-12 h-12 mx-auto mb-1.5 flex items-center justify-center">
          <img
            src={shop.logo}
            alt="RiSports Logo"
            className="w-full h-full object-contain"
            onError={(e) => {
              if (e.currentTarget.src !== window.location.origin + '/risports.png') {
                e.currentTarget.src = '/risports.png'
              }
            }}
          />
        </div>
        <h2 className="text-base font-bold tracking-tight text-zinc-900">{shop.name}</h2>
        <p className="text-[11px] text-zinc-500">{shop.tagline}</p>
        {shop.address && <p className="text-[11px] text-zinc-500 mt-0.5">{shop.address}</p>}
        {(shop.phone || shop.email) && (
          <p className="text-[11px] text-zinc-500">{[shop.phone, shop.email].filter(Boolean).join(' · ')}</p>
        )}
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F97316]">Receipt</p>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-2 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">Receipt no.</p>
          <p className="font-bold text-[12px] text-zinc-900">{order?.order_number || 'N/A'}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">Date</p>
          <p className="font-medium text-[12px] text-zinc-800">{formatDateTime(order?.created_at)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">Customer</p>
          <p className="font-medium text-[12px] text-zinc-800">{customer?.name || order?.customer_name || 'Walk-in customer'}</p>
          {customer?.phone && <p className="text-[11px] text-zinc-500">{customer.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">Status</p>
          <p className="font-medium capitalize text-[12px] text-zinc-800">{String(order?.status || '').replaceAll('_', ' ')}</p>
        </div>
      </div>

      {order?.occasion?.name && (
        <p className="text-[11px] mb-2 text-zinc-600">Event/Category: <span className="font-semibold text-zinc-900">{order.occasion.name}</span></p>
      )}

      <table className="w-full text-[11px] mt-1">
        <thead>
          <tr className="border-y border-zinc-200 text-[10px] uppercase tracking-wide text-zinc-400">
            <th className="text-left py-1.5 font-semibold">Item</th>
            <th className="text-center py-1.5 font-semibold">Qty</th>
            <th className="text-right py-1.5 font-semibold">Price</th>
            <th className="text-right py-1.5 font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id || item.product_id || idx} className="border-b border-zinc-100">
              <td className="py-1.5 pr-1 align-top break-words font-medium text-zinc-900">{item.product_name}</td>
              <td className="py-1.5 text-center align-top text-zinc-700">{item.quantity}</td>
              <td className="py-1.5 text-right align-top whitespace-nowrap text-zinc-700">{money(item.unit_price, shop.symbol)}</td>
              <td className="py-1.5 text-right font-medium align-top whitespace-nowrap text-zinc-900">{money(item.total ?? (item.quantity * item.unit_price), shop.symbol)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-0.5 text-[12px]">
        <div className="flex justify-between"><span className="text-zinc-500">Subtotal</span><span className="font-medium text-zinc-900">{money(order?.subtotal, shop.symbol)}</span></div>
        {Number(order?.discount) > 0 && (
          <div className="flex justify-between text-orange-600 font-medium"><span>Discount</span><span>- {money(order?.discount, shop.symbol)}</span></div>
        )}
        {Number(order?.tax) > 0 && (
          <div className="flex justify-between"><span className="text-zinc-500">Tax</span><span className="text-zinc-900">{money(order?.tax, shop.symbol)}</span></div>
        )}
        <div className="flex justify-between pt-1.5 mt-1.5 border-t-2 border-zinc-900 font-bold text-[13px] text-zinc-900">
          <span>Grand Total</span>
          <span className="text-[#F97316] font-extrabold">{money(order?.total, shop.symbol)}</span>
        </div>
      </div>

      {(order?.delivery_address || order?.delivery_date) && (
        <div className="mt-3 pt-2 border-t border-dashed border-zinc-300 text-[11px]">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-0.5">Delivery Details</p>
          {order.delivery_address && <p className="text-zinc-700">{order.delivery_address}</p>}
          {(order.delivery_date || order.delivery_time) && (
            <p className="text-zinc-500 mt-0.5">{[formatDate(order.delivery_date), order.delivery_time].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      )}

      {order?.notes && (
        <div className="mt-2 text-[11px] pt-1 border-t border-zinc-100">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">Notes</p>
          <p className="text-zinc-700">{order.notes}</p>
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-500 mt-4 pt-2 border-t border-dashed border-zinc-200">
        Thank you for choosing RiSports!
      </p>
    </div>
  )
}

export function printReceipt(order, settings) {
  const shop = shopBits(settings)
  const customer = order?.customer
  const items = order?.items || []
  
  // Build robust absolute logo URL
  const rawLogo = shop.logo || '/risports.png'
  const logoUrl = rawLogo.startsWith('http://') || rawLogo.startsWith('https://')
    ? rawLogo
    : `${window.location.origin}${rawLogo.startsWith('/') ? rawLogo : '/' + rawLogo}`

  const rows = items.map((item) => `
    <tr>
      <td style="padding: 5px 0; border-bottom: 1px solid #eee; vertical-align: top; font-weight: 500;">${esc(item.product_name)}</td>
      <td style="padding: 5px 0; border-bottom: 1px solid #eee; text-align: center; vertical-align: top;">${item.quantity}</td>
      <td style="padding: 5px 0; border-bottom: 1px solid #eee; text-align: right; vertical-align: top;">${money(item.unit_price, shop.symbol)}</td>
      <td style="padding: 5px 0; border-bottom: 1px solid #eee; text-align: right; vertical-align: top; font-weight: 600;">${money(item.total ?? (item.quantity * item.unit_price), shop.symbol)}</td>
    </tr>`).join('')

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>RiSports Receipt - ${esc(order?.order_number || '')}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 4mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111;
      margin: 0;
      padding: 0;
      background: #fff;
      font-size: 12px;
      line-height: 1.35;
    }
    .sheet {
      width: 72mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 4mm 0;
    }
    .center { text-align: center; }
    h1 {
      margin: 4px 0 2px;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .muted { color: #666; font-size: 11px; }
    .label { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #777; margin-bottom: 1px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
    th {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #666;
      border-top: 1px solid #ddd;
      border-bottom: 1px solid #ddd;
      padding: 5px 0;
      text-align: left;
    }
    .accent {
      color: #EA580C;
      font-weight: 800;
      letter-spacing: 0.16em;
      font-size: 10px;
      text-transform: uppercase;
      margin-top: 6px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-top: 3px;
    }
    .grand-total {
      display: flex;
      justify-content: space-between;
      font-weight: 800;
      font-size: 14px;
      border-top: 2px solid #111;
      padding-top: 6px;
      margin-top: 6px;
    }
    img.logo {
      width: 44px;
      height: 44px;
      object-fit: contain;
      margin: 0 auto 4px auto;
      display: block;
    }
    @media print {
      body { margin: 0; padding: 0; }
      .sheet { width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="center" style="border-bottom: 1px dashed #bbb; padding-bottom: 12px;">
      <img id="receipt-logo" class="logo" src="${esc(logoUrl)}" alt="RiSports" />
      <h1>${esc(shop.name)}</h1>
      <div class="muted">${esc(shop.tagline)}</div>
      ${shop.address ? `<div class="muted">${esc(shop.address)}</div>` : ''}
      ${(shop.phone || shop.email) ? `<div class="muted">${esc([shop.phone, shop.email].filter(Boolean).join(' · '))}</div>` : ''}
      <div class="accent">Receipt</div>
    </div>

    <table style="margin-top: 10px; border-bottom: 1px dashed #eee; padding-bottom: 6px;">
      <tr>
        <td style="padding: 2px 0;"><div class="label">Receipt no.</div><strong>${esc(order?.order_number || '')}</strong></td>
        <td style="padding: 2px 0; text-align: right;"><div class="label">Date</div>${esc(formatDateTime(order?.created_at))}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0 2px 0;"><div class="label">Customer</div>${esc(customer?.name || order?.customer_name || 'Walk-in customer')}${customer?.phone ? `<div class="muted">${esc(customer.phone)}</div>` : ''}</td>
        <td style="padding: 4px 0 2px 0; text-align: right;"><div class="label">Status</div><span style="text-transform: capitalize;">${esc(String(order?.status || '').replaceAll('_', ' '))}</span></td>
      </tr>
    </table>

    <table style="margin-top: 8px;">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Price</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div style="margin-top: 10px; font-size: 12px;">
      <div class="total-row"><span class="muted">Subtotal</span><span>${money(order?.subtotal, shop.symbol)}</span></div>
      ${Number(order?.discount) > 0 ? `<div class="total-row" style="color: #EA580C;"><span>Discount</span><span>- ${money(order?.discount, shop.symbol)}</span></div>` : ''}
      ${Number(order?.tax) > 0 ? `<div class="total-row"><span class="muted">Tax</span><span>${money(order?.tax, shop.symbol)}</span></div>` : ''}
      <div class="grand-total"><span>Grand Total</span><span>${money(order?.total, shop.symbol)}</span></div>
    </div>

    ${order?.notes ? `<div style="margin-top: 10px; border-top: 1px dashed #ddd; padding-top: 6px;"><div class="label">Notes</div><div>${esc(order.notes)}</div></div>` : ''}

    <p class="center muted" style="margin-top: 18px; border-top: 1px dashed #ddd; padding-top: 10px;">
      Thank you for choosing RiSports!
    </p>
  </div>

  <script>
    function triggerPrint() {
      window.focus();
      window.print();
    }

    var img = document.getElementById('receipt-logo');
    if (img && !img.complete) {
      img.onload = triggerPrint;
      img.onerror = triggerPrint;
    } else {
      window.onload = triggerPrint;
    }
  </script>
</body>
</html>`

  const popup = window.open('', 'risports-receipt', 'width=380,height=760')
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
    <div className="form-actions mt-4 pt-3 border-t border-[#3A3A3A] flex flex-col sm:flex-row justify-end gap-2">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-4 rounded-xl border border-[#3A3A3A] hover:bg-[#1A1A1A] text-white text-sm font-semibold transition-colors"
        >
          Close
        </button>
      )}
      <button
        type="button"
        onClick={onPrint}
        className="h-10 px-4 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
      >
        <Printer size={16} /> Print Receipt / PDF
      </button>
    </div>
  )
}
