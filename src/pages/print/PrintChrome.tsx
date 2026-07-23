// Shared wrapper for the three printable views. Provides an on-screen toolbar
// (hidden when printing), the standard event title header, and the paper-style
// signature footer that matches the original score sheets.

import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EVENT_TITLE } from '../../lib/constants'
import { nowStamp } from '../../lib/format'
import { Printer } from '../../components/icons'

export function PrintToolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="no-print sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
      <Link to="/admin" className="text-sm font-medium text-brand-700 hover:underline">
        ← Back to admin
      </Link>
      <div className="flex items-center gap-2">
        {children}
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>
    </div>
  )
}

export function PrintHeader({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="mb-4 text-center">
      <h1 className="text-lg font-bold">{EVENT_TITLE}</h1>
      <h2 className="mt-0.5 text-base font-semibold">{title}</h2>
      {meta && <p className="mt-1 text-xs text-slate-600">{meta}</p>}
    </div>
  )
}

export function SignatureFooter() {
  return (
    <div className="print-sheet mt-10 flex items-end justify-around pt-6 text-center text-xs">
      {['Judge', 'Judge', 'Event Director'].map((role, i) => (
        <div key={i}>
          <div className="mb-1 w-40 border-t border-dotted border-black" />
          <div className="font-semibold">{role}</div>
        </div>
      ))}
    </div>
  )
}

export function GeneratedStamp() {
  return <p className="mt-4 text-right text-[10px] text-slate-500">Generated {nowStamp()}</p>
}

/** Sets the document title while a print view is mounted (nice PDF filename). */
export function usePrintTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])
}
