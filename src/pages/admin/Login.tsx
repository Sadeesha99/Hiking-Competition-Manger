import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth'
import { EVENT_TITLE } from '../../lib/constants'
import { LogoMark } from '../../components/Logo'
import { Spinner } from '../../components/ui'

export default function Login() {
  const { signIn, mode } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="mb-3 h-14 w-14 rounded-xl" />
          <h1 className="text-lg font-bold text-slate-900">{EVENT_TITLE}</h1>
          <p className="text-sm text-slate-500">Admin / Judge sign in</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Sign in'}
          </button>

          {mode === 'local' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Demo mode.</strong> Default super-admin —{' '}
              <code className="font-mono">admin@htc.local</code> / <code className="font-mono">htc2026</code>. Data is
              stored on this device only. Configure Supabase for multi-device use.
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-sm">
          <Link to="/" className="text-brand-700 hover:underline">
            ← Back to public leaderboard
          </Link>
        </p>
      </div>
    </div>
  )
}
