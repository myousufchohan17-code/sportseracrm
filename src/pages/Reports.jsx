import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../context'
import { EmptyState, Spinner, StatusBadge, inputClass } from '../components/ui'
import { formatDate, money } from '../utils'
import { Header } from './Customers'

const TYPES = [
  { id: 'sales', label: 'Sales & revenue' },
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Product performance' },
  { id: 'customers', label: 'Customers' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'low-stock', label: 'Low stock' },
]

export function Reports() {
  const { settings, range, toast } = useApp()
  const [type, setType] = useState('sales')
  const [search, setSearch] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setData(await api(`/reports/${type}?from=${range.from}&to=${range.to}`)) }
    catch (err) { toast(err.message, 'error'); setData({ items: [] }) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [type, range.from, range.to])

  const exportCsv = async () => {
    const res = await fetch(`/api/reports/${type}/export?from=${range.from}&to=${range.to}`)
    if (!res.ok) {
      toast('Export failed', 'error')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}-report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const items = (data?.items || []).filter((row) => {
    if (!search.trim()) return true
    return JSON.stringify(row).toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-5">
      <Header title="Reports" subtitle={`Analytics for ${range.label.toLowerCase()}`} />
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        {TYPES.map((t) => (
          <button key={t.id} onClick={() => setType(t.id)} className={`h-10 px-4 rounded-2xl text-sm font-semibold border shrink-0 ${type === t.id ? 'bg-bloom text-white border-bloom' : 'bg-white border-line'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {data?.summary && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Stat label="Orders" value={data.summary.orders} />
          <Stat label="Revenue" value={money(data.summary.revenue, settings.currency_symbol)} />
          <Stat label="Average order" value={money(data.summary.average, settings.currency_symbol)} />
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-line">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter results" className={inputClass} />
          <button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-line text-sm font-semibold w-full sm:w-auto shrink-0">
            <Download size={16} /> Export CSV
          </button>
        </div>
        {loading ? <Spinner /> : items.length === 0 ? (
          <EmptyState title="No report data" description="There are no records in this date range. Reports only include real saved data." />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted bg-canvas/70">
                <tr>{columns(type).map((c) => <th key={c} className="text-left px-4 py-3">{c}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={row.id || row.product_id || row.name || i} className="border-t border-line">
                    {renderRow(type, row, settings.currency_symbol)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-xl sm:text-2xl font-bold mt-1 break-all">{value}</p>
    </div>
  )
}

function columns(type) {
  if (['sales', 'revenue', 'orders'].includes(type)) return ['Order', 'Customer', 'Status', 'Total', 'Date']
  if (type === 'products') return ['Product', 'Sold', 'Revenue', 'Stock']
  if (type === 'customers') return ['Customer', 'Phone', 'Orders', 'Spent']
  if (type === 'inventory' || type === 'low-stock') return ['Product', 'Stock', 'Threshold', 'Status']
  return ['Product', 'Sold', 'Revenue', 'Stock']
}

function renderRow(type, row, symbol) {
  if (['sales', 'revenue', 'orders'].includes(type)) {
    return (
      <>
        <td className="px-4 py-3 font-semibold">{row.order_number}</td>
        <td className="px-4 py-3">{row.customer_name || row.customer?.name || '—'}</td>
        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
        <td className="px-4 py-3">{money(row.total, symbol)}</td>
        <td className="px-4 py-3 text-muted">{formatDate(row.created_at)}</td>
      </>
    )
  }
  if (type === 'products') {
    return (
      <>
        <td className="px-4 py-3 font-semibold">{row.product_name}</td>
        <td className="px-4 py-3">{row.sold}</td>
        <td className="px-4 py-3">{money(row.revenue, symbol)}</td>
        <td className="px-4 py-3">{row.stock ?? '—'}</td>
      </>
    )
  }
  if (type === 'customers') {
    return (
      <>
        <td className="px-4 py-3 font-semibold">{row.name}</td>
        <td className="px-4 py-3">{row.phone || '—'}</td>
        <td className="px-4 py-3">{row.order_count}</td>
        <td className="px-4 py-3">{money(row.spent, symbol)}</td>
      </>
    )
  }
  if (type === 'inventory' || type === 'low-stock') {
    return (
      <>
        <td className="px-4 py-3 font-semibold">{row.name}</td>
        <td className="px-4 py-3">{row.stock}</td>
        <td className="px-4 py-3">{row.low_stock_threshold}</td>
        <td className="px-4 py-3"><StatusBadge status={row.stock_status} /></td>
      </>
    )
  }
  return (
    <>
      <td className="px-4 py-3 font-semibold">{row.name}</td>
      <td className="px-4 py-3">{row.order_count}</td>
      <td className="px-4 py-3">{money(row.revenue, symbol)}</td>
    </>
  )
}
