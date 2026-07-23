// ---------------------------------------------------------------------------
// Auth — email + password admin login (spec §2 View B, §9.7 role separation).
//
// Local mode:    accounts live in localStorage. A super-admin is seeded on
//                first run; the super-admin can add/remove judge accounts.
// Supabase mode: real Supabase Auth (create users in the Supabase dashboard).
//                The first/only super-admin email can be set via
//                VITE_SUPER_ADMIN_EMAIL; everyone else is treated as a judge.
//
// Public pages need no auth; everything under /admin is protected.
// ---------------------------------------------------------------------------

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { initStore, storeIsConfiguredForSupabase } from '../data/store'
import type { SupabaseStore } from '../data/supabaseStore'
import type { UserRole } from '../types'

export interface AuthUser {
  email: string
  role: UserRole
}

interface LocalAccount {
  email: string
  password: string
  role: UserRole
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  mode: 'local' | 'supabase'
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  // local-only user management (no-ops throw in supabase mode)
  listAccounts: () => LocalAccount[]
  addAccount: (email: string, password: string, role: UserRole) => void
  removeAccount: (email: string) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const USERS_KEY = 'htc:auth:users:v1'
const SESSION_KEY = 'htc:auth:session:v1'

const SEED_SUPER_ADMIN: LocalAccount = {
  email: 'admin@htc.local',
  password: 'htc2026',
  role: 'super_admin',
}

function readAccounts(): LocalAccount[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify([SEED_SUPER_ADMIN]))
      return [SEED_SUPER_ADMIN]
    }
    return JSON.parse(raw) as LocalAccount[]
  } catch {
    return [SEED_SUPER_ADMIN]
  }
}

function writeAccounts(accts: LocalAccount[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(accts))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = storeIsConfiguredForSupabase() ? 'supabase' : 'local'
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const superAdminEmail = import.meta.env.VITE_SUPER_ADMIN_EMAIL?.toLowerCase()

  const roleFor = useCallback(
    (email: string): UserRole => (superAdminEmail && email.toLowerCase() === superAdminEmail ? 'super_admin' : 'judge'),
    [superAdminEmail],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (mode === 'local') {
          readAccounts() // ensure seed exists
          const raw = localStorage.getItem(SESSION_KEY)
          if (raw && !cancelled) setUser(JSON.parse(raw) as AuthUser)
        } else {
          const store = (await initStore()) as SupabaseStore
          const { data } = await store.client.auth.getSession()
          if (!cancelled && data.session?.user?.email) {
            setUser({ email: data.session.user.email, role: roleFor(data.session.user.email) })
          }
          store.client.auth.onAuthStateChange((_e, session) => {
            if (session?.user?.email) setUser({ email: session.user.email, role: roleFor(session.user.email) })
            else setUser(null)
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, roleFor])

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (mode === 'local') {
        const acct = readAccounts().find((a) => a.email.toLowerCase() === email.toLowerCase().trim())
        if (!acct || acct.password !== password) throw new Error('Invalid email or password.')
        const u: AuthUser = { email: acct.email, role: acct.role }
        localStorage.setItem(SESSION_KEY, JSON.stringify(u))
        setUser(u)
      } else {
        const store = (await initStore()) as SupabaseStore
        const { error } = await store.client.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(error.message)
      }
    },
    [mode],
  )

  const signOut = useCallback(async () => {
    if (mode === 'local') {
      localStorage.removeItem(SESSION_KEY)
      setUser(null)
    } else {
      const store = (await initStore()) as SupabaseStore
      await store.client.auth.signOut()
      setUser(null)
    }
  }, [mode])

  const listAccounts = useCallback(() => (mode === 'local' ? readAccounts() : []), [mode])

  const addAccount = useCallback(
    (email: string, password: string, role: UserRole) => {
      if (mode !== 'local') throw new Error('Manage users in the Supabase dashboard when Supabase is configured.')
      const accts = readAccounts()
      if (accts.some((a) => a.email.toLowerCase() === email.toLowerCase().trim())) throw new Error('That email already exists.')
      accts.push({ email: email.trim(), password, role })
      writeAccounts(accts)
    },
    [mode],
  )

  const removeAccount = useCallback(
    (email: string) => {
      if (mode !== 'local') throw new Error('Manage users in the Supabase dashboard when Supabase is configured.')
      const accts = readAccounts().filter((a) => a.email.toLowerCase() !== email.toLowerCase())
      if (!accts.some((a) => a.role === 'super_admin')) throw new Error('Cannot remove the last super-admin.')
      writeAccounts(accts)
    },
    [mode],
  )

  return (
    <AuthContext.Provider value={{ user, loading, mode, signIn, signOut, listAccounts, addAccount, removeAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
