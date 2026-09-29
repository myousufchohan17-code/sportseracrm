import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Flower2, ShoppingBag, Users, Wallet, Clock3, Plus, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { api } from '../api'
import { useApp } from '../context'
import { EmptyState, Spinner, StatusBadge } from '../components/ui'
import { formatDate, greeting, money } from '../utils'

const PIE_COLORS = ['#F5A15A', '#A78BFA', '#7DD3FC', '#7BC9A6', '#FB923C', '#34D399', '#94A3B8']

export function Dashboard() {
  const { settings, range } = useApp()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    api(`/dashboard?from=${range.from}&to=${range.to}`)
      .then((d) => { if (alive) setData(d) })
      .catch((err) => { if (alive) setError(err.message || 'Failed to load dashboard') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [range.from, range.to])

  const statusData = useMemo(
    () => (data?.order_status || []).filter((s) => s.count > 0),
    [data]
  )
  const symbol = data?.currency_symbol || settings.currency_symbol || '$'

  if (loading && !data) return <Spinner label="Loading dashboard…" />

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </div>
        <h3 className="font-semibold text-ink">Failed to load dashboard</h3>
        <p className="text-sm text-muted mt-1 max-w-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 px-4 py-2.5 rounded-xl bg-bloom text-white text-sm font-semibold hover:bg-bloom-dark"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!data) return null

  const cards = [
    { label: 'Total Orders', value: data.stats.orders.value, change: data.stats.orders.change, icon: ShoppingBag, tone: 'bg-blush text-bloom' },
    { label: 'Total Customers', value: data.stats.customers.value, change: data.stats.customers.change, icon: Users, tone: 'bg-mint-soft text-mint' },
    { label: 'Total Revenue', value: money(data.stats.revenue.value, symbol), change: data.stats.revenue.change, icon: Wallet, tone: 'bg-lavender-soft text-lavender' },
    { label: 'Pending Orders', value: data.stats.pending.value, change: data.stats.pending.change, icon: Clock3, tone: 'bg-peach-soft text-peach' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{greeting()}</p>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-ink mt-1">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Live shop performance for {range.label.toLowerCase()}.</p>
        </div>
        <button onClick={() => navigate('/orders/new')} className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-2xl bg-bloom text-white text-sm font-semibold hover:bg-bloom-dark w-full sm:w-auto">
          <Plus size={16} /> Create Order
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-4 sm:p-5 min-w-0">
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl grid place-items-center ${card.tone}`}>
                <card.icon size={20} />
              </div>
              <Trend change={card.change} />
            </div>
            <p className="text-sm text-muted mt-3 sm:mt-4">{card.label}</p>
            <p className="text-xl sm:text-2xl font-bold mt-1 break-all">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 xl:col-span-2 min-h-[280px] sm:min-h-[320px] min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <h2 className="font-semibold">Sales Overview</h2>
              <p className="text-xs text-muted">Revenue from completed, non-cancelled orders</p>
            </div>
          </div>
          {data.sales_overview.length === 0 ? (
            <EmptyState icon={Wallet} title="No sales yet" description="Create and confirm orders to see your sales trend." actionLabel="Create Order" onAction={() => navigate('/orders/new')} />
          ) : (
            <div className="h-48 sm:h-64 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.sales_overview} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#fecaca" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8D8086' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis width={28} tick={{ fontSize: 10, fill: '#8D8086' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => money(v, symbol)} />
                  <Area type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2.5} fill="url(#salesFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card p-4 sm:p-5 min-h-[280px] sm:min-h-[320px] min-w-0">
          <h2 className="font-semibold">Order Status</h2>
          <p className="text-xs text-muted mb-4">Distribution for the selected dates</p>
          {statusData.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders yet" description="Statuses will appear here after you create orders." />
          ) : (
            <>
              <div className="h-40 sm:h-44 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="status" innerRadius={42} outerRadius={64} paddingAngle={3}>
                      {statusData.map((entry, i) => (
                        <Cell key={entry.status} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {statusData.map((s, i) => (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 capitalize text-muted">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {s.status.replaceAll('_', ' ')}
                    </span>
                    <span className="font-semibold text-ink">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
        <div className="card overflow-hidden min-w-0">
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-line">
            <h2 className="font-semibold">Top Selling Products</h2>
            <Link to="/reports" className="text-xs font-semibold text-bloom">View all</Link>
          </div>
          {data.top_products.length === 0 ? (
            <EmptyState icon={Flower2} title="No product sales" description="Top sellers will show here after confirmed orders." actionLabel="Add Product" onAction={() => navigate('/products')} />
          ) : (
            <ul className="divide-y divide-line">
              {data.top_products.map((p) => (
                <li key={p.product_id || p.product_name} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                  {p.image ? <img src={p.image} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" /> : (
                    <div className="w-11 h-11 rounded-xl bg-blush text-bloom grid place-items-center shrink-0"><Flower2 size={18} /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.product_name}</p>
                    <p className="text-xs text-muted">{p.sold} sold</p>
                  </div>
                  <p className="text-sm font-bold shrink-0">{money(p.revenue, symbol)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card overflow-hidden xl:col-span-2 min-w-0">
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-line">
            <h2 className="font-semibold">Recent Orders</h2>
            <Link to="/orders" className="text-xs font-semibold text-bloom">View all</Link>
          </div>
          {data.recent_orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders yet" description="New orders will appear here as soon as they are created." actionLabel="Create Order" onAction={() => navigate('/orders/new')} />
          ) : (
            <>
              <div className="md:hidden divide-y divide-line">
                {data.recent_orders.map((o) => (
                  <button key={o.id} type="button" onClick={() => navigate(`/orders/${o.id}`)} className="w-full text-left px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{o.order_number}</p>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-sm text-muted mt-1">{o.customer?.name || o.customer_name || 'Walk-in'}</p>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="font-semibold">{money(o.total, symbol)}</span>
                      <span className="text-muted text-xs">{formatDate(o.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted bg-canvas/70">
                    <tr>
                      <th className="text-left font-semibold px-5 py-3">Order</th>
                      <th className="text-left font-semibold px-5 py-3">Customer</th>
                      <th className="text-left font-semibold px-5 py-3">Amount</th>
                      <th className="text-left font-semibold px-5 py-3">Status</th>
                      <th className="text-left font-semibold px-5 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_orders.map((o) => (
                      <tr key={o.id} className="border-t border-line hover:bg-canvas/50 cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                        <td className="px-5 py-3 font-semibold">{o.order_number}</td>
                        <td className="px-5 py-3">{o.customer?.name || o.customer_name || 'Walk-in'}</td>
                        <td className="px-5 py-3">{money(o.total, symbol)}</td>
                        <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                        <td className="px-5 py-3 text-muted">{formatDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}

function Trend({ change }) {
  const up = change >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center text-xs font-semibold ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
      <Icon size={14} /> {Math.abs(change || 0)}%
    </span>
  )
}


