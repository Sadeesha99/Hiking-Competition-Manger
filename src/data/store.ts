// ---------------------------------------------------------------------------
// Backend-agnostic data layer.
//
// `DataStore` is the interface every mutation/read goes through. Two adapters
// implement it:
//   - LocalStore    (localStorage; the default "demo" mode, works offline on a
//                     single device with no setup)
//   - SupabaseStore  (Postgres + Auth + Realtime; multi-device, live board)
//
// The factory picks Supabase automatically when VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY are set, otherwise falls back to LocalStore. This is
// exactly the behaviour documented in .env.example.
// ---------------------------------------------------------------------------

import type {
  Adjustment,
  AppSettings,
  AuditLogEntry,
  Criterion,
  CriterionType,
  DataSnapshot,
  GameEvent,
  ID,
  Player,
  ScoringMethod,
  Team,
} from '../types'

/** Full persisted state = the public snapshot plus the append-only audit log. */
export interface PersistState extends DataSnapshot {
  audit_log: AuditLogEntry[]
}

export interface Actor {
  email: string | null
}

export interface TeamInput {
  name: string
  entry_no: string
}
export interface EventInput {
  name: string
  scoring_method: ScoringMethod
  event_total?: number | null
  scale_to?: number | null
}
export interface CriterionInput {
  name: string
  type: CriterionType
  max_marks?: number | null
}
export interface ScoreInput {
  event_id: ID
  criterion_id: ID
  team_id: ID
  player_id: ID | null
  value: number | null
  time_start?: string | null
  time_end?: string | null
}

export interface DataStore {
  readonly mode: 'local' | 'supabase'

  load(): Promise<PersistState>
  /** Register for change notifications. Returns an unsubscribe function. */
  subscribe(cb: () => void): () => void

  // teams & players
  createTeam(input: TeamInput, actor: Actor): Promise<Team>
  updateTeam(id: ID, patch: Partial<TeamInput>, actor: Actor): Promise<void>
  deleteTeam(id: ID, actor: Actor): Promise<void>
  addPlayer(teamId: ID, name: string, isLeader: boolean, actor: Actor): Promise<Player>
  updatePlayer(id: ID, patch: Partial<Pick<Player, 'name' | 'is_leader' | 'order_index'>>, actor: Actor): Promise<void>
  deletePlayer(id: ID, actor: Actor): Promise<void>

  // events & criteria
  createEvent(input: EventInput, actor: Actor): Promise<GameEvent>
  updateEvent(id: ID, patch: Partial<Omit<GameEvent, 'id' | 'created_at'>>, actor: Actor): Promise<void>
  deleteEvent(id: ID, actor: Actor): Promise<void>
  addCriterion(eventId: ID, input: CriterionInput, actor: Actor): Promise<Criterion>
  updateCriterion(id: ID, patch: Partial<CriterionInput>, actor: Actor): Promise<void>
  deleteCriterion(id: ID, actor: Actor): Promise<void>

  // scores & lifecycle
  setScore(input: ScoreInput, actor: Actor): Promise<void>
  finalizeEvent(eventId: ID, actor: Actor): Promise<void>
  unlockEvent(eventId: ID, actor: Actor): Promise<void>

  // adjustments
  addAdjustment(teamId: ID, delta: number, reason: string, actor: Actor): Promise<Adjustment>

  // settings & admin
  updateSettings(patch: Partial<Omit<AppSettings, 'id'>>, actor: Actor): Promise<void>
  resetCompetition(actor: Actor, withDemo: boolean): Promise<void>
}

let _store: DataStore | null = null

/** Returns the initialized store, or throws if initStore() has not run yet. */
export function getStore(): DataStore {
  if (!_store) throw new Error('Data store not initialized — call initStore() first.')
  return _store
}

/**
 * Async store initializer used by the app root. Resolves to the correct adapter
 * and caches it for getStore().
 */
export async function initStore(): Promise<DataStore> {
  if (_store) return _store
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (url && key) {
    const { SupabaseStore } = await import('./supabaseStore')
    _store = new SupabaseStore(url, key)
  } else {
    const { LocalStore } = await import('./localStore')
    _store = new LocalStore()
  }
  return _store
}

export function storeIsConfiguredForSupabase(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}
