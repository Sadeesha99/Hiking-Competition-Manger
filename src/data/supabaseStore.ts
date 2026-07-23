// ---------------------------------------------------------------------------
// SupabaseStore — DataStore backed by Supabase (Postgres + Realtime).
//
// Enabled automatically when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
// set. Gives multi-device use and a live public board via realtime. Requires
// the schema in /supabase/schema.sql (tables + RLS: public read, admin write).
//
// The public leaderboard reads with the anon key (RLS allows SELECT). All
// mutations require an authenticated admin session (RLS allows write only to
// authenticated users). Auth itself is handled in src/auth/auth.tsx.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Adjustment,
  AppSettings,
  AuditAction,
  Criterion,
  GameEvent,
  ID,
  Player,
  Team,
} from '../types'
import { DEFAULT_SETTINGS, buildDemoTeams, buildEventsAndCriteria, newId } from './seed'
import type {
  Actor,
  CriterionInput,
  DataStore,
  EventInput,
  PersistState,
  ScoreInput,
  TeamInput,
} from './store'

export class SupabaseStore implements DataStore {
  readonly mode = 'supabase' as const
  private sb: SupabaseClient

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  }

  get client(): SupabaseClient {
    return this.sb
  }

  subscribe(cb: () => void): () => void {
    const channel = this.sb
      .channel('htc-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => cb())
      .subscribe()
    return () => {
      void this.sb.removeChannel(channel)
    }
  }

  async load(): Promise<PersistState> {
    const [teams, players, events, criteria, scores, adjustments, settings, audit] = await Promise.all([
      this.sb.from('teams').select('*').order('entry_no'),
      this.sb.from('players').select('*').order('order_index'),
      this.sb.from('events').select('*').order('order_index'),
      this.sb.from('criteria').select('*').order('order_index'),
      this.sb.from('scores').select('*'),
      this.sb.from('adjustments').select('*').order('created_at'),
      this.sb.from('settings').select('*').limit(1).maybeSingle(),
      this.sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(2000),
    ])
    return {
      teams: (teams.data ?? []) as Team[],
      players: (players.data ?? []) as Player[],
      events: (events.data ?? []) as GameEvent[],
      criteria: (criteria.data ?? []) as Criterion[],
      scores: (scores.data ?? []) as PersistState['scores'],
      adjustments: (adjustments.data ?? []) as Adjustment[],
      settings: (settings.data as AppSettings | null) ?? { ...DEFAULT_SETTINGS },
      audit_log: (audit.data ?? []) as PersistState['audit_log'],
    }
  }

  private async log(entry: {
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
    await this.sb.from('audit_log').insert({
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
    })
  }

  private unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
    if (res.error) throw new Error(res.error.message)
    return res.data as T
  }

  // ---- teams & players ---------------------------------------------------
  async createTeam(input: TeamInput, actor: Actor): Promise<Team> {
    const row = { id: newId(), name: input.name.trim(), entry_no: input.entry_no.trim(), created_at: new Date().toISOString() }
    const team = this.unwrap(await this.sb.from('teams').insert(row).select().single())
    await this.log({ action: 'create', entity_type: 'team', entity_id: row.id, new_value: row, team_id: row.id, actor })
    return team as unknown as Team
  }

  async updateTeam(id: ID, patch: Partial<TeamInput>, actor: Actor): Promise<void> {
    this.unwrap(await this.sb.from('teams').update(patch).eq('id', id).select().single())
    await this.log({ action: 'update', entity_type: 'team', entity_id: id, new_value: patch, team_id: id, actor })
  }

  async deleteTeam(id: ID, actor: Actor): Promise<void> {
    await this.sb.from('teams').delete().eq('id', id) // cascades via FK
    await this.log({ action: 'delete', entity_type: 'team', entity_id: id, team_id: id, actor })
  }

  async addPlayer(teamId: ID, name: string, isLeader: boolean, actor: Actor): Promise<Player> {
    if (isLeader) await this.sb.from('players').update({ is_leader: false }).eq('team_id', teamId)
    const { count } = await this.sb.from('players').select('*', { count: 'exact', head: true }).eq('team_id', teamId)
    const row = { id: newId(), team_id: teamId, name: name.trim(), is_leader: isLeader, order_index: count ?? 0 }
    const player = this.unwrap(await this.sb.from('players').insert(row).select().single())
    await this.log({ action: 'create', entity_type: 'player', entity_id: row.id, new_value: row, team_id: teamId, actor })
    return player as unknown as Player
  }

  async updatePlayer(
    id: ID,
    patch: Partial<Pick<Player, 'name' | 'is_leader' | 'order_index'>>,
    actor: Actor,
  ): Promise<void> {
    if (patch.is_leader) {
      const { data } = await this.sb.from('players').select('team_id').eq('id', id).single()
      if (data) await this.sb.from('players').update({ is_leader: false }).eq('team_id', (data as Player).team_id)
    }
    this.unwrap(await this.sb.from('players').update(patch).eq('id', id).select().single())
    await this.log({ action: 'update', entity_type: 'player', entity_id: id, new_value: patch, actor })
  }

  async deletePlayer(id: ID, actor: Actor): Promise<void> {
    await this.sb.from('players').delete().eq('id', id)
    await this.log({ action: 'delete', entity_type: 'player', entity_id: id, actor })
  }

  // ---- events & criteria -------------------------------------------------
  async createEvent(input: EventInput, actor: Actor): Promise<GameEvent> {
    const { count } = await this.sb.from('events').select('*', { count: 'exact', head: true })
    const row = {
      id: newId(),
      name: input.name.trim(),
      scoring_method: input.scoring_method,
      event_total: input.event_total ?? null,
      scale_to: input.scale_to ?? null,
      status: 'draft',
      order_index: count ?? 0,
      created_at: new Date().toISOString(),
    }
    const event = this.unwrap(await this.sb.from('events').insert(row).select().single())
    await this.log({ action: 'create', entity_type: 'event', entity_id: row.id, new_value: row, event_id: row.id, actor })
    return event as unknown as GameEvent
  }

  async updateEvent(id: ID, patch: Partial<Omit<GameEvent, 'id' | 'created_at'>>, actor: Actor): Promise<void> {
    this.unwrap(await this.sb.from('events').update(patch).eq('id', id).select().single())
    const action: AuditAction =
      patch.scale_to !== undefined || patch.event_total !== undefined ? 'recalculate' : 'update'
    await this.log({ action, entity_type: 'event', entity_id: id, new_value: patch, event_id: id, actor })
  }

  async deleteEvent(id: ID, actor: Actor): Promise<void> {
    await this.sb.from('events').delete().eq('id', id)
    await this.log({ action: 'delete', entity_type: 'event', entity_id: id, event_id: id, actor })
  }

  async addCriterion(eventId: ID, input: CriterionInput, actor: Actor): Promise<Criterion> {
    const { count } = await this.sb.from('criteria').select('*', { count: 'exact', head: true }).eq('event_id', eventId)
    const row = {
      id: newId(),
      event_id: eventId,
      name: input.name.trim(),
      type: input.type,
      max_marks: input.max_marks ?? null,
      order_index: count ?? 0,
    }
    const criterion = this.unwrap(await this.sb.from('criteria').insert(row).select().single())
    await this.log({ action: 'create', entity_type: 'criterion', entity_id: row.id, new_value: row, event_id: eventId, actor })
    return criterion as unknown as Criterion
  }

  async updateCriterion(id: ID, patch: Partial<CriterionInput>, actor: Actor): Promise<void> {
    this.unwrap(await this.sb.from('criteria').update(patch).eq('id', id).select().single())
    const action: AuditAction = patch.max_marks !== undefined ? 'recalculate' : 'update'
    await this.log({ action, entity_type: 'criterion', entity_id: id, new_value: patch, actor })
  }

  async deleteCriterion(id: ID, actor: Actor): Promise<void> {
    await this.sb.from('criteria').delete().eq('id', id)
    await this.log({ action: 'delete', entity_type: 'criterion', entity_id: id, actor })
  }

  // ---- scores ------------------------------------------------------------
  async setScore(input: ScoreInput, actor: Actor): Promise<void> {
    const now = new Date().toISOString()
    const match = this.sb
      .from('scores')
      .select('*')
      .eq('event_id', input.event_id)
      .eq('criterion_id', input.criterion_id)
      .eq('team_id', input.team_id)
    const { data: existingRows } = input.player_id
      ? await match.eq('player_id', input.player_id)
      : await match.is('player_id', null)
    const existing = (existingRows ?? [])[0] as PersistState['scores'][number] | undefined

    const payload = {
      value: input.value,
      time_start: input.time_start ?? null,
      time_end: input.time_end ?? null,
      updated_by: actor.email,
      updated_at: now,
    }
    if (existing) {
      this.unwrap(await this.sb.from('scores').update(payload).eq('id', existing.id).select().single())
    } else {
      this.unwrap(
        await this.sb
          .from('scores')
          .insert({
            id: newId(),
            event_id: input.event_id,
            criterion_id: input.criterion_id,
            team_id: input.team_id,
            player_id: input.player_id ?? null,
            ...payload,
          })
          .select()
          .single(),
      )
    }
    await this.log({
      action: 'score_set',
      entity_type: 'score',
      entity_id: input.criterion_id,
      old_value: existing ? { value: existing.value } : null,
      new_value: { value: input.value },
      team_id: input.team_id,
      event_id: input.event_id,
      actor,
    })
  }

  async finalizeEvent(eventId: ID, actor: Actor): Promise<void> {
    await this.sb.from('events').update({ status: 'final' }).eq('id', eventId)
    await this.log({ action: 'finalize', entity_type: 'event', entity_id: eventId, event_id: eventId, actor })
  }

  async unlockEvent(eventId: ID, actor: Actor): Promise<void> {
    await this.sb.from('events').update({ status: 'draft' }).eq('id', eventId)
    await this.log({ action: 'unlock', entity_type: 'event', entity_id: eventId, event_id: eventId, actor })
  }

  // ---- adjustments -------------------------------------------------------
  async addAdjustment(teamId: ID, delta: number, reason: string, actor: Actor): Promise<Adjustment> {
    if (!reason.trim()) throw new Error('A reason is required for every adjustment.')
    const row = { id: newId(), team_id: teamId, delta, reason: reason.trim(), created_by: actor.email, created_at: new Date().toISOString() }
    const adj = this.unwrap(await this.sb.from('adjustments').insert(row).select().single())
    await this.log({ action: 'adjustment', entity_type: 'adjustment', entity_id: row.id, new_value: row, reason: row.reason, team_id: teamId, actor })
    return adj as unknown as Adjustment
  }

  // ---- settings & admin --------------------------------------------------
  async updateSettings(patch: Partial<Omit<AppSettings, 'id'>>, actor: Actor): Promise<void> {
    await this.sb.from('settings').upsert({ id: 'settings', ...patch })
    await this.log({ action: 'update', entity_type: 'settings', entity_id: 'settings', new_value: patch, actor })
  }

  async resetCompetition(actor: Actor, withDemo: boolean): Promise<void> {
    // wipe competition data (audit_log is preserved as an append-only trail)
    for (const table of ['scores', 'adjustments', 'criteria', 'events', 'players', 'teams']) {
      await this.sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }
    const { events, criteria } = buildEventsAndCriteria()
    const { teams, players } = withDemo ? buildDemoTeams() : { teams: [], players: [] }
    if (teams.length) await this.sb.from('teams').insert(teams)
    if (players.length) await this.sb.from('players').insert(players)
    await this.sb.from('events').insert(events)
    await this.sb.from('criteria').insert(criteria)
    await this.sb.from('settings').upsert({ ...DEFAULT_SETTINGS })
    await this.log({ action: 'reset', entity_type: 'competition', entity_id: null, new_value: { withDemo }, actor })
  }
}
