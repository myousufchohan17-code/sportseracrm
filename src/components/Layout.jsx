import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useApp } from '../context'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function Layout() {
  const { toasts } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-svh bg-canvas flex overflow-x-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Outlet />
        </main>
      </div>
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 sm:right-4 z-50 space-y-2 max-w-[calc(100vw-1.5rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`min-w-0 w-full sm:min-w-[240px] rounded-2xl px-4 py-3 text-sm font-medium shadow-lg border ${
              t.type === 'error' ? 'bg-white border-rose-200 text-rose-600' : 'bg-white border-mint text-emerald-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
