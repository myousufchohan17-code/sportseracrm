import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { rangePreset } from './utils'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [bootstrapping, setBootstrapping] = useState(true)
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState({})
  const [theme, setTheme] = useState(() => localStorage.getItem('risports-theme') || 'dark')
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
    document.documentElement.dataset.theme = theme
    localStorage.setItem('risports-theme', theme)
  }, [theme])

  useEffect(() => {
    api('/auth/me')
      .then(async (data) => {
        if (data.authenticated) {
          setUser(data)
          await refreshMe()
        }
      })
      .finally(() => setBootstrapping(false))
  }, [refreshMe])

  useEffect(() => {
    const expireSession = () => {
      setUser(null)
      setSettings({})
    }
    window.addEventListener('auth:expired', expireSession)
    return () => window.removeEventListener('auth:expired', expireSession)
  }, [])

  const login = useCallback(async (credentials) => {
    const data = await api('/auth/login', { method: 'POST', body: credentials })
    setUser(data)
    await refreshMe()
  }, [refreshMe])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
    setSettings({})
  }, [])

  const value = useMemo(
    () => ({
      bootstrapping,
      user,
      settings,
      setSettings,
      theme,
      setTheme,
      range,
      setRange,
      toast,
      toasts,
      refreshMe,
      login,
      logout,
    }),
    [bootstrapping, user, settings, theme, range, toast, toasts, refreshMe, login, logout]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
