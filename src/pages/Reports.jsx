import { useEffect, useState } from 'react'
import { Download, LockKeyhole } from 'lucide-react'
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
  const [reportState, setReportState] = useState({ key: '', data: null })
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinBusy, setPinBusy] = useState(false)

  const requestKey = `${type}:${range.from}:${range.to}`
  const data = reportState.key === requestKey ? reportState.data : null
  const loading = unlocked && reportState.key !== requestKey

  useEffect(() => {
    if (!unlocked) return
    let active = true
    api(`/reports/${type}?from=${range.from}&to=${range.to}`)
      .then((result) => {
        if (active) setReportState({ key: requestKey, data: result })
      })
      .catch((err) => {
        if (active) {
          toast(err.message, 'error')
          setReportState({ key: requestKey, data: { items: [] } })
        }
      })
    return () => { active = false }
  }, [unlocked, requestKey, type, range.from, range.to, toast])

  const unlock = async (event) => {
    event.preventDefault()
    setPinBusy(true)
    setPinError('')
    try {
      await api('/reports/unlock', { method: 'POST', body: { pin } })
      setUnlocked(true)
      setPin('')
    } catch (err) {
      setPinError(err.message || 'Incorrect PIN')
    } finally {
      setPinBusy(false)
    }
  }

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

  if (!unlocked) {
    return (
      <div className="space-y-5">
        <Header title="Reports" subtitle="Restricted access" />
        <div className="card mx-auto max-w-md p-6 sm:p-8">
          <div className="mb-5 grid size-12 place-items-center rounded-xl bg-[#F97316]/15 text-[#F97316]"><LockKeyhole size={22} /></div>
          <h2 className="text-lg font-bold text-white">Enter reports PIN</h2>
          <form onSubmit={unlock} className="mt-5 space-y-4">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{4}"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4-digit PIN"
              aria-label="4-digit reports PIN"
              required
              className={`${inputClass} text-center text-lg`}
            />
            {pinError && <p role="alert" className="text-sm text-rose-400">{pinError}</p>}
            <button disabled={pinBusy || pin.length !== 4} className="h-11 w-full rounded-xl bg-[#F97316] text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60">
              {pinBusy ? 'Checking…' : 'Unlock reports'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Header title="Reports" subtitle={`Analytics for ${range.label.toLowerCase()}`} />
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`h-10 px-4 rounded-2xl text-sm font-semibold border shrink-0 transition-colors ${
              type === t.id
                ? 'bg-[#F97316] text-white border-[#F97316]'
                : 'bg-[#1A1A1A] text-[#A3A3A3] hover:text-white border-[#3A3A3A]'
            }`}
          >
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
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-[#3A3A3A]">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter results" className={inputClass} />
          <button
            onClick={exportCsv}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] hover:bg-[#262626] text-white text-sm font-semibold w-full sm:w-auto shrink-0 transition-colors"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
        {loading ? <Spinner /> : items.length === 0 ? (
          <EmptyState title="No report data" description="There are no records in this date range. Reports only include real saved data." />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full text-sm">
              <thead className="text-xs text-[#A3A3A3] bg-[#1A1A1A]">
                <tr>{columns(type).map((c) => <th key={c} className="text-left px-4 py-3">{c}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={row.id || row.product_id || row.name || i} className="border-t border-[#3A3A3A] hover:bg-[#1A1A1A]/40 text-white">
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
