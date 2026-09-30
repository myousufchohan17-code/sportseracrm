import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarRange, ChevronDown, Search, Settings } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../context'
import { useDebounced } from '../hooks'
import { money, rangePreset } from '../utils'
import { MenuButton } from './Sidebar'

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom' },
]

export function Header({ onMenu }) {
  const { settings, range, setRange } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [openSearch, setOpenSearch] = useState(false)
  const [openRange, setOpenRange] = useState(false)
  const [openBell, setOpenBell] = useState(false)
  const [notes, setNotes] = useState({ items: [], unread: 0 })
  const debounced = useDebounced(query, 280)
  const searchRef = useRef(null)
  const rangeRef = useRef(null)
  const bellRef = useRef(null)

  useEffect(() => {
    api('/notifications').then(setNotes).catch(() => {})
  }, [openBell])

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults(null)
      return
    }
    api(`/search?q=${encodeURIComponent(debounced)}`).then((data) => {
      setResults(data)
      setOpenSearch(true)
    }).catch(() => {})
  }, [debounced])

  useEffect(() => {
    const onClick = (e) => {
      if (!searchRef.current?.contains(e.target)) setOpenSearch(false)
      if (!rangeRef.current?.contains(e.target)) setOpenRange(false)
      if (!bellRef.current?.contains(e.target)) setOpenBell(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = (path) => {
    setOpenSearch(false)
    setQuery('')
    navigate(path)
  }

  return (
    <header className="sticky top-0 z-30 bg-[#1A1A1A]/95 backdrop-blur-md border-b border-[#3A3A3A] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-1.5 sm:gap-3 px-3 sm:px-4 lg:px-6 h-16 sm:h-[72px]">
        <MenuButton onClick={onMenu} />
        <div className="relative flex-1 min-w-0" ref={searchRef}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results && setOpenSearch(true)}
            placeholder="Search orders, customers, products…"
            className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-3 rounded-2xl bg-[#0F0F0F] border border-[#3A3A3A] focus:border-[#F97316] soft-ring text-sm text-white placeholder:text-[#A3A3A3]/60"
          />
          {openSearch && results && (
            <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-[#262626] border border-[#3A3A3A] shadow-2xl overflow-hidden z-40">
              {!results.orders.length && !results.customers.length && !results.products.length ? (
                <p className="px-4 py-6 text-sm text-[#A3A3A3] text-center">No matching records</p>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto py-2">
                  {results.orders.length > 0 && (
                    <Group title="Orders">
                      {results.orders.map((o) => (
                        <button key={o.id} onClick={() => go(`/orders/${o.id}`)} className="w-full text-left px-4 py-2 hover:bg-[#1A1A1A] text-sm flex items-center justify-between text-white">
                          <span className="font-semibold">{o.order_number}</span>
                          <span className="text-[#A3A3A3] text-xs">{o.customer_name || 'Walk-in'}</span>
                        </button>
                      ))}
                    </Group>
                  )}
                  {results.customers.length > 0 && (
                    <Group title="Customers">
                      {results.customers.map((c) => (
                        <button key={c.id} onClick={() => go(`/customers/${c.id}`)} className="w-full text-left px-4 py-2 hover:bg-[#1A1A1A] text-sm flex items-center justify-between text-white">
                          <span className="font-semibold">{c.name}</span>
                          <span className="text-[#A3A3A3] text-xs">{c.phone || c.email}</span>
                        </button>
                      ))}
                    </Group>
                  )}
                  {results.products.length > 0 && (
                    <Group title="Products">
                      {results.products.map((p) => (
                        <button key={p.id} onClick={() => go('/products')} className="w-full text-left px-4 py-2 hover:bg-[#1A1A1A] text-sm flex items-center justify-between text-white">
                          <span className="font-semibold">{p.name}</span>
                          <span className="text-[#F97316] font-medium">{money(p.price, settings.currency_symbol)}</span>
                        </button>
                      ))}
                    </Group>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="relative shrink-0" ref={rangeRef}>
          <button
            type="button"
            onClick={() => { setOpenRange((v) => !v); setOpenBell(false) }}
            className="flex items-center justify-center gap-2 h-10 w-10 sm:h-11 sm:w-auto sm:px-3 rounded-2xl border border-[#3A3A3A] bg-[#1A1A1A] text-white hover:bg-[#262626] text-sm font-medium transition-colors"
          >
            <CalendarRange size={16} className="text-[#F97316]" />
            <span className="hidden sm:inline whitespace-nowrap">{range.label || 'Date range'}</span>
            <ChevronDown size={14} className="hidden sm:block text-[#A3A3A3]" />
          </button>
          {openRange && (
            <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl bg-[#262626] border border-[#3A3A3A] shadow-2xl p-3 z-40">
              <div className="grid grid-cols-2 gap-2 mb-3">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (p.id === 'custom') {
                        setRange((cur) => ({ ...cur, preset: 'custom', label: 'Custom' }))
                        return
                      }
                      setRange(rangePreset(p.id))
                      setOpenRange(false)
                    }}
                    className={`text-xs font-semibold rounded-xl px-2 py-2 border transition-colors ${
                      range.preset === p.id
                        ? 'bg-[#F97316]/15 border-[#F97316] text-[#F97316]'
                        : 'border-[#3A3A3A] hover:bg-[#1A1A1A] text-[#A3A3A3]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) => setRange((r) => ({ ...r, from: e.target.value, preset: 'custom', label: 'Custom' }))}
                  className="rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] text-white px-2 py-2 text-xs w-full"
                />
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) => setRange((r) => ({ ...r, to: e.target.value, preset: 'custom', label: 'Custom' }))}
                  className="rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] text-white px-2 py-2 text-xs w-full"
                />
              </div>
            </div>
          )}
        </div>
        <div className="relative shrink-0" ref={bellRef}>
          <button
            type="button"
            onClick={() => { setOpenBell((v) => !v); setOpenRange(false) }}
            className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border border-[#3A3A3A] bg-[#1A1A1A] hover:bg-[#262626] text-white grid place-items-center transition-colors"
          >
            <Bell size={18} />
            {notes.unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#F97316]" />}
          </button>
          {openBell && (
            <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl bg-[#262626] border border-[#3A3A3A] shadow-2xl overflow-hidden z-40">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#3A3A3A]">
                <p className="text-sm font-semibold text-white">Notifications</p>
                <button
                  type="button"
                  className="text-xs text-[#F97316] hover:text-[#EA580C] font-semibold"
                  onClick={async () => {
                    await api('/notifications/read-all', { method: 'POST' })
                    const data = await api('/notifications')
                    setNotes(data)
                  }}
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notes.items.length === 0 ? (
                  <p className="p-6 text-sm text-[#A3A3A3] text-center">No notifications yet</p>
                ) : notes.items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={async () => {
                      await api(`/notifications/${n.id}/read`, { method: 'PATCH' })
                      setOpenBell(false)
                      if (n.link) navigate(n.link)
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-[#3A3A3A] last:border-0 hover:bg-[#1A1A1A] transition-colors ${
                      n.read ? 'text-[#A3A3A3]' : 'bg-[#F97316]/10 text-white'
                    }`}
                  >
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-xs text-[#A3A3A3] mt-0.5">{n.message}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="shrink-0 flex items-center justify-center gap-2 h-10 w-10 sm:h-11 sm:w-auto sm:pl-1.5 sm:pr-3 rounded-2xl border border-[#3A3A3A] bg-[#1A1A1A] hover:bg-[#262626] text-white transition-colors"
          title="Settings"
        >
          <span className="w-8 h-8 rounded-xl bg-[#F97316] text-white grid place-items-center">
            <Settings size={16} />
          </span>
          <span className="hidden md:block text-sm font-semibold max-w-[140px] truncate">{settings.shop_name || 'RiSports'}</span>
        </button>
      </div>
    </header>
  )
}

function Group({ title, children }) {
  return (
    <div>
      <p className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#A3A3A3]">{title}</p>
      {children}
    </div>
  )
}
