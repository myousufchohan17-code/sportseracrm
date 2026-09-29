import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, Users, Flower2, Tags, Package,
  BarChart3, Settings, ChevronLeft, Menu, X,
} from 'lucide-react'
import { useApp } from '../context'

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'bg-blush text-bloom' },
  { to: '/orders', label: 'Orders', icon: ShoppingBag, color: 'bg-lavender-soft text-lavender' },
  { to: '/customers', label: 'Customers', icon: Users, color: 'bg-mint-soft text-mint' },
  { to: '/products', label: 'Products', icon: Flower2, color: 'bg-rose-50 text-rose-400' },
  { to: '/categories', label: 'Categories', icon: Tags, color: 'bg-peach-soft text-peach' },
  { to: '/inventory', label: 'Inventory', icon: Package, color: 'bg-emerald-50 text-emerald-500' },
  { to: '/reports', label: 'Reports', icon: BarChart3, color: 'bg-lime-50 text-lime-600' },
  { to: '/settings', label: 'Settings', icon: Settings, color: 'bg-slate-100 text-slate-500' },
]

function SidebarPanel({ collapsed, setCollapsed, setMobileOpen, mobile }) {
  const { settings } = useApp()
  const compact = collapsed && !mobile

  return (
    <aside className={`h-full bg-white border-r border-line flex flex-col ${compact ? 'w-[84px]' : 'w-[min(280px,86vw)] lg:w-[260px]'}`}>
      <div className="flex items-center gap-3 px-4 h-16 sm:h-20 border-b border-line">
        {settings.logo ? (
          <img src={settings.logo} alt="" className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-bloom text-white grid place-items-center shadow-sm shrink-0">
            <Flower2 size={20} />
          </div>
        )}
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink truncate">{settings.shop_name || 'SportsEra Sports Shop CRM'}</p>
            <p className="text-[11px] text-muted truncate">{settings.shop_tagline || 'Sports Shop CRM'}</p>
          </div>
        )}
        {mobile && (
          <button type="button" onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-canvas text-muted" aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-blush text-bloom' : 'text-ink/70 hover:bg-canvas'
              }`
            }
          >
            <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${item.color}`}>
              <item.icon size={18} />
            </span>
            {!compact && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      {!mobile && (
        <div className="p-3 border-t border-line">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden lg:flex w-full items-center justify-center gap-2 text-xs text-muted py-2 rounded-xl hover:bg-canvas"
          >
            <ChevronLeft size={14} className={collapsed ? 'rotate-180' : ''} />
            {!collapsed && 'Collapse'}
          </button>
        </div>
      )}
    </aside>
  )
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      <div className="hidden lg:block h-svh sticky top-0 shrink-0">
        <SidebarPanel collapsed={collapsed} setCollapsed={setCollapsed} setMobileOpen={setMobileOpen} />
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
          <div className="relative h-full max-w-[280px] w-[min(280px,86vw)] shadow-2xl pt-[env(safe-area-inset-top)]">
            <SidebarPanel collapsed={false} setCollapsed={setCollapsed} setMobileOpen={setMobileOpen} mobile />
          </div>
        </div>
      )}
    </>
  )
}

export function MenuButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="lg:hidden shrink-0 p-2 rounded-xl border border-line bg-white" aria-label="Open menu">
      <Menu size={18} />
    </button>
  )
}
