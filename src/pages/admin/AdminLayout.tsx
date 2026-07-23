import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth'
import { useData } from '../../data/DataContext'
import { EVENT_TITLE } from '../../lib/constants'
import { cx } from '../../components/ui'
import { LogoMark } from '../../components/Logo'
import {
  ChartBar,
  Clipboard,
  Cog,
  Flag,
  LogOut,
  Menu,
  Refresh,
  Trophy,
  Users,
  X,
} from '../../components/icons'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: ChartBar, end: true },
  { to: '/admin/teams', label: 'Teams & Players', icon: Users, end: false },
  { to: '/admin/events', label: 'Events & Criteria', icon: Flag, end: false },
  { to: '/admin/score', label: 'Score Entry', icon: Clipboard, end: false },
  { to: '/admin/adjustments', label: 'Adjustments', icon: Trophy, end: false },
  { to: '/admin/audit', label: 'Audit Log', icon: Refresh, end: false },
  { to: '/admin/settings', label: 'Settings', icon: Cog, end: false },
]

export default function AdminLayout() {
  const { user, signOut, mode } = useAuth()
  const { error } = useData()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100',
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-full lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <LogoMark className="h-8 w-8" />
          <div className="leading-tight">
            <p className="text-xs font-bold text-slate-900">HTC Poonagala</p>
            <p className="text-[11px] text-slate-500">2026 · Admin</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{navLinks}</div>
        <UserFooter user={user?.email} role={user?.role} mode={mode} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button className="btn-ghost -ml-2 p-2" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">HTC Poonagala · Admin</span>
          <Link to="/" className="text-xs font-semibold text-brand-700">
            Public
          </Link>
        </header>

        {error && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Data warning: {error}
          </div>
        )}

        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <span className="flex items-center gap-2 text-sm font-bold">
                <LogoMark className="h-7 w-7" /> {EVENT_TITLE.split(' ').slice(0, 2).join(' ')}
              </span>
              <button className="btn-ghost -mr-2 p-2" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{navLinks}</div>
            <UserFooter user={user?.email} role={user?.role} mode={mode} onSignOut={handleSignOut} />
          </div>
        </div>
      )}
    </div>
  )
}

function UserFooter({
  user,
  role,
  mode,
  onSignOut,
}: {
  user?: string
  role?: string
  mode: 'local' | 'supabase'
  onSignOut: () => void
}) {
  return (
    <div className="border-t border-slate-200 p-3">
      <div className="mb-2 px-1">
        <p className="truncate text-xs font-medium text-slate-700">{user}</p>
        <p className="text-[11px] text-slate-400">
          {role === 'super_admin' ? 'Super admin' : 'Judge'} · {mode === 'local' ? 'Demo (local)' : 'Supabase'}
        </p>
      </div>
      <button className="btn-secondary w-full" onClick={onSignOut}>
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  )
}
