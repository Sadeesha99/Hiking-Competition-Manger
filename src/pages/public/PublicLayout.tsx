import { Link, Outlet } from 'react-router-dom'
import { EVENT_TITLE } from '../../lib/constants'
import { LogoMark } from '../../components/Logo'

export default function PublicLayout() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-brand-800/20 bg-brand-800 text-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <div className="leading-tight">
              <h1 className="text-sm font-bold sm:text-base">{EVENT_TITLE}</h1>
              <p className="text-[11px] text-brand-200">Live leaderboard</p>
            </div>
          </div>
          <Link
            to="/admin"
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
          >
            Admin
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-slate-400">
        {EVENT_TITLE}
      </footer>
    </div>
  )
}
