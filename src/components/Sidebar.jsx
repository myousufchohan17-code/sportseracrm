import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, Users, Package, Tags, Boxes,
  BarChart3, Settings, ChevronLeft, Menu, X,
} from 'lucide-react'
import { useApp } from '../context'

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders / POS', icon: ShoppingBag },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function SidebarPanel({ collapsed, setCollapsed, setMobileOpen, mobile }) {
  const { settings } = useApp()
  const compact = collapsed && !mobile
  const logoSrc = settings.logo || '/risports.png'

  return (
    <aside className={`h-full bg-[#1A1A1A] border-r border-[#3A3A3A] flex flex-col ${compact ? 'w-[84px]' : 'w-[min(280px,86vw)] lg:w-[260px]'}`}>
      <div className="flex items-center gap-3 px-4 h-16 sm:h-20 border-b border-[#3A3A3A]">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#262626] border border-[#3A3A3A] overflow-hidden flex items-center justify-center shrink-0">
          <img
            src={logoSrc}
            alt="RiSports"
            className="w-full h-full object-contain p-1"
            onError={(e) => {
              if (e.currentTarget.src !== window.location.origin + '/risports.png') {
                e.currentTarget.src = '/risports.png'
              }
            }}
          />
        </div>
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white text-base tracking-tight truncate">{settings.shop_name || 'RiSports'}</p>
            <p className="text-[11px] text-[#A3A3A3] truncate">{settings.shop_tagline || 'Sports Equipment & Apparel'}</p>
          </div>
        )}
        {mobile && (
          <button type="button" onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-[#262626] text-[#A3A3A3] hover:text-white transition-colors" aria-label="Close menu">
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
              `flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#F97316]/15 text-[#F97316] font-semibold'
                  : 'text-[#A3A3A3] hover:bg-[#262626] hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 transition-colors ${
                  isActive ? 'bg-[#F97316] text-white' : 'bg-[#262626] text-[#A3A3A3] group-hover:text-white'
                }`}>
                  <item.icon size={18} />
                </span>
                {!compact && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {!mobile && (
        <div className="p-3 border-t border-[#3A3A3A]">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden lg:flex w-full items-center justify-center gap-2 text-xs text-[#A3A3A3] hover:text-white py-2 rounded-xl hover:bg-[#262626] transition-colors"
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
          <button className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
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
    <button type="button" onClick={onClick} className="lg:hidden shrink-0 p-2 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] text-[#A3A3A3] hover:text-white transition-colors" aria-label="Open menu">
      <Menu size={18} />
    </button>
  )
}
