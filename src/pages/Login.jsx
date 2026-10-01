import { useState } from 'react'
import { Eye, EyeOff, LogIn, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useApp } from '../context'

export function Login() {
  const { login, theme, setTheme } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login({ email, password })
    } catch (err) {
      setError(err.message || 'Unable to sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="signin-page min-h-svh grid place-items-center px-4 py-8">
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="fixed right-4 top-4 z-10 grid size-11 place-items-center rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] text-white hover:bg-[#262626]"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <section className="signin-panel w-full max-w-md border border-[#3A3A3A] bg-[#1A1A1A] p-6 sm:p-9 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-xl bg-[#F97316] text-white">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-[#F97316]">RiSports</p>
            <p className="mt-1 text-sm text-[#A3A3A3]">Secure workspace access</p>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">Sign in</h1>
        <p className="mt-2 text-sm text-[#A3A3A3]">Use your account to open the CRM and POS.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block space-y-2 text-sm font-semibold text-white">
            Email address
            <input
              autoComplete="username"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
              className="signin-input h-12 w-full rounded-lg border border-[#3A3A3A] bg-[#0F0F0F] px-3 text-sm text-white placeholder:text-[#A3A3A3] focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
            />
          </label>
          <label className="block space-y-2 text-sm font-semibold text-white">
            Password
            <span className="relative block">
              <input
                autoComplete="current-password"
                type={visible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                className="signin-input h-12 w-full rounded-lg border border-[#3A3A3A] bg-[#0F0F0F] px-3 pr-12 text-sm text-white placeholder:text-[#A3A3A3] focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
              />
              <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[#A3A3A3] hover:text-white"
                aria-label={visible ? 'Hide password' : 'Show password'}
                title={visible ? 'Hide password' : 'Show password'}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {error && <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 text-sm font-bold text-white transition-colors hover:bg-[#EA580C] disabled:cursor-wait disabled:opacity-60"
          >
            <LogIn size={17} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
