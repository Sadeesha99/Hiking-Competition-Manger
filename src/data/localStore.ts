// ---------------------------------------------------------------------------
// LocalStore — a full DataStore backed by localStorage.
//
// This makes the app 100% functional with zero setup (great for a dry run, a
// single scoring laptop, or a paper fallback). It is single-device: state lives
// in the browser. For multi-device / live-across-phones, configure Supabase
// (see .env.example) and the app switches to SupabaseStore automatically.
//
// Every mutation writes an append-only audit_log row, exactly as the spec (§7)
// requires, and persists immediately.
// ---------------------------------------------------------------------------

import type {
  Adjustment,
  AuditAction,
  AuditLogEntry,
  Criterion,
  GameEvent,
  ID,
  Player,
  Team,
} from '../types'
import {
  buildDemoTeams,
  buildEventsAndCriteria,
  DEFAULT_SETTINGS,
  newId,
} from './seed'
import type {
  Actor,
  CriterionInput,
  DataStore,
  EventInput,
  PersistState,
  ScoreInput,
  TeamInput,
} from './store'

const STORAGE_KEY = 'htc:data:v1'

function freshState(withDemo: boolean): PersistState {
  const { events, criteria } = buildEventsAndCriteria()
  const { teams, players } = withDemo ? buildDemoTeams() : { teams: [], players: [] }
  return {
    teams,
    players,
    events,
    criteria,
    scores: [],
    adjustments: [],
    settings: { ...DEFAULT_SETTINGS },
    audit_log: [],
  }
}

export class LocalStore implements DataStore {
  readonly mode = 'local' as const
  private state: PersistState
  private subscribers = new Set<() => void>()

  constructor() {
    this.state = this.read() ?? freshState(true)
    this.persist() // ensure a value exists so other tabs can read it
    // keep in sync across browser tabs
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        const next = this.read()
        if (next) {
          this.state = next
          this.notify()
        }
      }
    })
  }

  // ---- persistence -------------------------------------------------------
  private read(): PersistState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as PersistState
    } catch {
      return null
    }
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
  }

  private commit() {
    this.persist()
    this.notify()
  }

  private notify() {
    this.subscribers.forEach((cb) => cb())
  }

  subscribe(cb: () => void): () => void {
    this.subscribers.add(cb)
    return () => this.subscribers.delete(cb)
  }

  async load(): Promise<PersistState> {
    // return a deep copy so callers never mutate our internal state directly
    return structuredClone(this.state)
  }

  // ---- audit helper ------------------------------------------------------
  private log(entry: {
    action: AuditAction
    entity_type: string
    entity_id: ID | null
    old_value?: unknown
    new_value?: unknown
    reason?: string | null
    team_id?: ID | null
    event_id?: ID | null
    actor: Actor
  }) {
    const row: AuditLogEntry = {
      id: newId(),
      actor: entry.actor.email,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      old_value: entry.old_value ?? null,
      new_value: entry.new_value ?? null,
      reason: entry.reason ?? null,
      team_id: entry.team_id ?? null,
      event_id: entry.event_id ?? null,
      created_at: new Date().toISOString(),
    }
    this.state.audit_log.push(row)
  }

  // ---- teams & players ---------------------------------------------------
  async createTeam(input: TeamInput, actor: Actor): Promise<Team> {
    if (this.state.teams.some((t) => t.entry_no === input.entry_no)) {
      throw new Error(`Entry number ${input.entry_no} is already used.`)
    }
    const team: Team = {
      id: newId(),
      name: input.name.trim(),
      entry_no: input.entry_no.trim(),
      created_at: new Date().toISOString(),
    }
    this.state.teams.push(team)
    this.log({ action: 'create', entity_type: 'team', entity_id: team.id, new_value: team, team_id: team.id, actor })
    this.commit()
    return team
  }

  async updateTeam(id: ID, patch: Partial<TeamInput>, actor: Actor): Promise<void> {
    const team = this.state.teams.find((t) => t.id === id)
    if (!team) throw new Error('Team not found')
    if (patch.entry_no && this.state.teams.some((t) => t.id !== id && t.entry_no === patch.entry_no)) {
      throw new Error(`Entry number ${patch.entry_no} is already used.`)
    }
    const old = { ...team }
    Object.assign(team, {
      name: patch.name?.trim() ?? team.name,
      entry_no: patch.entry_no?.trim() ?? team.entry_no,
    })
    this.log({ action: 'update', entity_type: 'team', entity_id: id, old_value: old, new_value: { ...team }, team_id: id, actor })
    this.commit()
  }

  async deleteTeam(id: ID, actor: Actor): Promise<void> {
    const team = this.state.teams.find((t) => t.id === id)
    if (!team) return
    this.state.players = this.state.players.filter((p) => p.team_id !== id)
    this.state.scores = this.state.scores.filter((s) => s.team_id !== id)
    this.state.adjustments = this.state.adjustments.filter((a) => a.team_id !== id)
    this.state.teams = this.state.teams.filter((t) => t.id !== id)
    this.log({ action: 'delete', entity_type: 'team', entity_id: id, old_value: team, team_id: id, actor })
    this.commit()
  }

  async addPlayer(teamId: ID, name: string, isLeader: boolean, actor: Actor): Promise<Player> {
    const existing = this.state.players.filter((p) => p.team_id === teamId)
    if (isLeader) {
      // enforce at most one leader per team
      existing.forEach((p) => (p.is_leader = false))
    }
    const player: Player = {
      id: newId(),
      team_id: teamId,
      name: name.trim(),
      is_leader: isLeader,
      order_index: existing.length,
    }
    this.state.players.push(player)
    this.log({ action: 'create', entity_type: 'player', entity_id: player.id, new_value: player, team_id: teamId, actor })
    this.commit()
    return player
  }

  async updatePlayer(
    id: ID,
    patch: Partial<Pick<Player, 'name' | 'is_leader' | 'order_index'>>,
    actor: Actor,
  ): Promise<void> {
    const player = this.state.players.find((p) => p.id === id)
    if (!player) throw new Error('Player not found')
    const old = { ...player }
    if (patch.is_leader) {
      this.state.players.filter((p) => p.team_id === player.team_id && p.id !== id).forEach((p) => (p.is_leader = false))
    }
    Object.assign(player, {
      name: patch.name?.trim() ?? player.name,
      is_leader: patch.is_leader ?? player.is_leader,
      order_index: patch.order_index ?? player.order_index,
    })
    this.log({ action: 'update', entity_type: 'player', entity_id: id, old_value: old, new_value: { ...player }, team_id: player.team_id, actor })
    this.commit()
  }

  async deletePlayer(id: ID, actor: Actor): Promise<void> {
    const player = this.state.players.find((p) => p.id === id)
    if (!player) return
    this.state.scores = this.state.scores.filter((s) => s.player_id !== id)
    this.state.players = this.state.players.filter((p) => p.id !== id)
    this.log({ action: 'delete', entity_type: 'player', entity_id: id, old_value: player, team_id: player.team_id, actor })
    this.commit()
  }

  // ---- events & criteria -------------------------------------------------
  async createEvent(input: EventInput, actor: Actor): Promise<GameEvent> {
    const event: GameEvent = {
      id: newId(),
      name: input.name.trim(),
      scoring_method: input.scoring_method,
      event_total: input.event_total ?? null,
      scale_to: input.scale_to ?? null,
      status: 'draft',
      order_index: this.state.events.length,
      created_at: new Date().toISOString(),
    }
    this.state.events.push(event)
    this.log({ action: 'create', entity_type: 'event', entity_id: event.id, new_value: event, event_id: event.id, actor })
    this.commit()
    return event
  }

  async updateEvent(id: ID, patch: Partial<Omit<GameEvent, 'id' | 'created_at'>>, actor: Actor): Promise<void> {
    const event = this.state.events.find((e) => e.id === id)
    if (!event) throw new Error('Event not found')
    const old = { ...event }
    Object.assign(event, patch)
    if (typeof event.name === 'string') event.name = event.name.trim()
    // editing scale/total/etc is itself a recalculation-triggering change (§5, §6)
    const action: AuditAction =
      patch.scale_to !== undefined || patch.event_total !== undefined ? 'recalculate' : 'update'
    this.log({ action, entity_type: 'event', entity_id: id, old_value: old, new_value: { ...event }, event_id: id, actor })
    this.commit()
  }

  async deleteEvent(id: ID, actor: Actor): Promise<void> {
    const event = this.state.events.find((e) => e.id === id)
    if (!event) return
    this.state.criteria = this.state.criteria.filter((c) => c.event_id !== id)
    this.state.scores = this.state.scores.filter((s) => s.event_id !== id)
    this.state.events = this.state.events.filter((e) => e.id !== id)
    this.log({ action: 'delete', entity_type: 'event', entity_id: id, old_value: event, event_id: id, actor })
    this.commit()
  }

  async addCriterion(eventId: ID, input: CriterionInput, actor: Actor): Promise<Criterion> {
    const count = this.state.criteria.filter((c) => c.event_id === eventId).length
    const criterion: Criterion = {
      id: newId(),
      event_id: eventId,
      name: input.name.trim(),
      type: input.type,
      max_marks: input.max_marks ?? null,
      order_index: count,
    }
    this.state.criteria.push(criterion)
    this.log({ action: 'create', entity_type: 'criterion', entity_id: criterion.id, new_value: criterion, event_id: eventId, actor })
    this.commit()
    return criterion
  }

  async updateCriterion(id: ID, patch: Partial<CriterionInput>, actor: Actor): Promise<void> {
    const criterion = this.state.criteria.find((c) => c.id === id)
    if (!criterion) throw new Error('Criterion not found')
    const old = { ...criterion }
    Object.assign(criterion, {
      name: patch.name?.trim() ?? criterion.name,
      type: patch.type ?? criterion.type,
      max_marks: patch.max_marks !== undefined ? patch.max_marks : criterion.max_marks,
    })
    const action: AuditAction = patch.max_marks !== undefined ? 'recalculate' : 'update'
    this.log({ action, entity_type: 'criterion', entity_id: id, old_value: old, new_value: { ...criterion }, event_id: criterion.event_id, actor })
    this.commit()
  }

  async deleteCriterion(id: ID, actor: Actor): Promise<void> {
    const criterion = this.state.criteria.find((c) => c.id === id)
    if (!criterion) return
    this.state.scores = this.state.scores.filter((s) => s.criterion_id !== id)
    this.state.criteria = this.state.criteria.filter((c) => c.id !== id)
    this.log({ action: 'delete', entity_type: 'criterion', entity_id: id, old_value: criterion, event_id: criterion.event_id, actor })
    this.commit()
  }

  // ---- scores ------------------------------------------------------------
  async setScore(input: ScoreInput, actor: Actor): Promise<void> {
    const existing = this.state.scores.find(
      (s) =>
        s.event_id === input.event_id &&
        s.criterion_id === input.criterion_id &&
        s.team_id === input.team_id &&
        (s.player_id ?? null) === (input.player_id ?? null),
    )
    const now = new Date().toISOString()
    const old = existing ? { ...existing } : null

    if (existing) {
      existing.value = input.value
      existing.time_start = input.time_start ?? null
      existing.time_end = input.time_end ?? null
      existing.updated_by = actor.email
      existing.updated_at = now
    } else {
      this.state.scores.push({
        id: newId(),
        event_id: input.event_id,
        criterion_id: input.criterion_id,
        team_id: input.team_id,
        player_id: input.player_id ?? null,
        value: input.value,
        time_start: input.time_start ?? null,
        time_end: input.time_end ?? null,
        updated_by: actor.email,
        updated_at: now,
      })
    }
    this.log({
      action: 'score_set',
      entity_type: 'score',
      entity_id: input.criterion_id,
      old_value: old ? { value: old.value, time_start: old.time_start, time_end: old.time_end } : null,
      new_value: { value: input.value, time_start: input.time_start ?? null, time_end: input.time_end ?? null },
      team_id: input.team_id,
      event_id: input.event_id,
      actor,
    })
    this.commit()
  }

  async finalizeEvent(eventId: ID, actor: Actor): Promise<void> {
    const event = this.state.events.find((e) => e.id === eventId)
    if (!event) return
    event.status = 'final'
    this.log({ action: 'finalize', entity_type: 'event', entity_id: eventId, new_value: { status: 'final' }, event_id: eventId, actor })
    this.commit()
  }

  async unlockEvent(eventId: ID, actor: Actor): Promise<void> {
    const event = this.state.events.find((e) => e.id === eventId)
    if (!event) return
    event.status = 'draft'
    this.log({ action: 'unlock', entity_type: 'event', entity_id: eventId, new_value: { status: 'draft' }, event_id: eventId, actor })
    this.commit()
  }

  // ---- adjustments -------------------------------------------------------
  async addAdjustment(teamId: ID, delta: number, reason: string, actor: Actor): Promise<Adjustment> {
    if (!reason.trim()) throw new Error('A reason is required for every adjustment.')
    const adj: Adjustment = {
      id: newId(),
      team_id: teamId,
      delta,
      reason: reason.trim(),
      created_by: actor.email,
      created_at: new Date().toISOString(),
    }
    this.state.adjustments.push(adj)
    this.log({ action: 'adjustment', entity_type: 'adjustment', entity_id: adj.id, new_value: adj, reason: adj.reason, team_id: teamId, actor })
    this.commit()
    return adj
  }

  // ---- settings & admin --------------------------------------------------
  async updateSettings(patch: Partial<Omit<import('../types').AppSettings, 'id'>>, actor: Actor): Promise<void> {
    const old = { ...this.state.settings }
    Object.assign(this.state.settings, patch)
    this.log({ action: 'update', entity_type: 'settings', entity_id: 'settings', old_value: old, new_value: { ...this.state.settings }, actor })
    this.commit()
  }

  async resetCompetition(actor: Actor, withDemo: boolean): Promise<void> {
    const preservedLog = this.state.audit_log
    this.state = freshState(withDemo)
    // keep the historical audit trail and record the reset itself
    this.state.audit_log = preservedLog
    this.log({ action: 'reset', entity_type: 'competition', entity_id: null, new_value: { withDemo }, actor })
    this.commit()
  }
}
