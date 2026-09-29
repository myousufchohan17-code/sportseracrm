import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { rangePreset } from './utils'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [bootstrapping, setBootstrapping] = useState(true)
  const [settings, setSettings] = useState({})
  const [toasts, setToasts] = useState([])
  const [range, setRange] = useState(() => rangePreset('month'))

  const toast = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, message, type }])
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 3200)
  }, [])

  const refreshMe = useCallback(async () => {
    try {
      const data = await api('/settings')
      setSettings(data)
    } catch {
      setSettings({})
    }
  }, [])

  useEffect(() => {
    refreshMe().finally(() => setBootstrapping(false))
  }, [refreshMe])

  const value = useMemo(
    () => ({
      bootstrapping,
      settings,
      setSettings,
      range,
      setRange,
      toast,
      toasts,
      refreshMe,
    }),
    [bootstrapping, settings, range, toast, toasts, refreshMe]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
