// ---------------------------------------------------------------------------
// Domain model for the Hiking Team Challenge Poonagala 2026 scoring app.
// Mirrors the data model in the spec (§13). Kept backend-agnostic so the same
// types are used by both the Supabase adapter and the local demo adapter.
// ---------------------------------------------------------------------------

export type ID = string

export type ScoringMethod = 'TEAM' | 'INDIVIDUAL'
export type CriterionType = 'number' | 'time' | 'penalty'
export type EventStatus = 'draft' | 'final'
export type UserRole = 'super_admin' | 'judge'

export interface Team {
  id: ID
  name: string
  entry_no: string // "01".."22" — unique
  created_at: string
}

export interface Player {
  id: ID
  team_id: ID
  name: string
  is_leader: boolean
  order_index: number
}

export interface GameEvent {
  id: ID
  name: string
  scoring_method: ScoringMethod
  event_total: number | null // optional; if null, derive from criteria max_marks
  scale_to: number | null // optional; if null, no scaling (defaults to event_max)
  status: EventStatus
  order_index: number
  created_at: string
}

export interface Criterion {
  id: ID
  event_id: ID
  name: string
  type: CriterionType
  max_marks: number | null
  order_index: number
}

/**
 * One score cell.
 *  - TEAM events:       one row per (event, criterion, team)     -> player_id = null
 *  - INDIVIDUAL events: one row per (event, criterion, player)   -> player_id set
 * `value` is the mark, or the *magnitude* of a penalty (always stored positive;
 * the scoring engine subtracts penalty-type criteria).
 */
export interface Score {
  id: ID
  event_id: ID
  criterion_id: ID
  team_id: ID
  player_id: ID | null
  value: number | null
  time_start: string | null // "HH:MM" or "HH:MM:SS" for type=time
  time_end: string | null
  updated_by: string | null
  updated_at: string
}

export interface Adjustment {
  id: ID
  team_id: ID
  delta: number // signed: + bonus, - penalty
  reason: string // mandatory
  created_by: string | null
  created_at: string
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'score_set'
  | 'finalize'
  | 'unlock'
  | 'adjustment'
  | 'recalculate'
  | 'reset'

export interface AuditLogEntry {
  id: ID
  actor: string | null
  action: AuditAction
  entity_type: string // 'team' | 'player' | 'event' | 'criterion' | 'score' | 'adjustment' | ...
  entity_id: ID | null
  old_value: unknown | null
  new_value: unknown | null
  reason: string | null
  // convenience denormalised references so the log viewer can filter without joins
  team_id: ID | null
  event_id: ID | null
  created_at: string
}

export interface AppSettings {
  id: ID
  tie_break_text: string
  rounding_dp: number // decimal places for scaled scores
}

/** Full snapshot the data layer hands to the UI. */
export interface DataSnapshot {
  teams: Team[]
  players: Player[]
  events: GameEvent[]
  criteria: Criterion[]
  scores: Score[]
  adjustments: Adjustment[]
  settings: AppSettings
}

// -------- Derived / computed shapes used by the UI ------------------------

export interface TeamEventScore {
  team_id: ID
  event_id: ID
  raw: number // sum of number-criteria minus penalties
  eventMax: number | null
  scaled: number // scaled contribution to the main board
  entered: boolean // any score present for this team/event
  scaleApplied: boolean // scaling actually changed the raw value
}

export interface TeamStanding {
  team: Team
  eventScores: Record<ID, TeamEventScore> // keyed by event_id
  eventsTotal: number // sum of scaled event scores
  adjustmentsTotal: number
  total: number // eventsTotal + adjustmentsTotal
  rank: number
}

export interface PlayerContribution {
  player: Player
  team: Team
  points: number
}

/** A single player's contribution within one event (for the Reports section). */
export interface PlayerEventContribution {
  player: Player
  team: Team
  raw: number // marks the player entered in the event
  scaled: number // what those marks count as on the main board
  scaleApplied: boolean // the event's scaling changed raw → scaled
}
