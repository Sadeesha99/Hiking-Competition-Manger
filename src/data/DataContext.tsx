// React binding for the data layer. Loads the full snapshot, keeps it fresh
// (store subscription + a light poll so the public board auto-refreshes per
// spec §2/§9), and exposes the store for mutations.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuditLogEntry } from '../types'
import { getStore, initStore, type DataStore, type PersistState } from './store'

interface DataContextValue {
  state: PersistState | null
  auditLog: AuditLogEntry[]
  store: DataStore | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

const POLL_MS = 20_000 // public board auto-refresh cadence

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const storeRef = useRef<DataStore | null>(null)

  const refresh = useCallback(async () => {
    try {
      const store = storeRef.current ?? getStore()
      const next = await store.load()
      setState(next)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    let unsub: (() => void) | undefined
    let poll: ReturnType<typeof setInterval> | undefined
    let cancelled = false

    ;(async () => {
      try {
        const store = await initStore()
        if (cancelled) return
        storeRef.current = store
        await refresh()
        unsub = store.subscribe(() => void refresh())
        poll = setInterval(() => void refresh(), POLL_MS)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      unsub?.()
      if (poll) clearInterval(poll)
    }
  }, [refresh])

  return (
    <DataContext.Provider
      value={{
        state,
        auditLog: state?.audit_log ?? [],
        store: storeRef.current,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within a DataProvider')
  return ctx
}

/** Convenience: the store, guaranteed non-null (throws if used before init). */
export function useStore(): DataStore {
  const { store } = useData()
  if (!store) throw new Error('Store not ready')
  return store
}
