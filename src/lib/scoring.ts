// ---------------------------------------------------------------------------
// Scoring engine — pure, side-effect-free functions.
// Implements the derived-score rules from the spec (§6, §13).
//
//   event_max(event)         = event_total  OR  sum of criteria max_marks
//   team_raw(team,event)     = Σ number-criteria − Σ penalty-criteria
//   team_scaled(team,event)  = team_raw × (COALESCE(scale_to, event_max) / event_max)
//   team_main_total(team)    = Σ team_scaled over events + Σ adjustments.delta
//   player_individual_total  = Σ, over INDIVIDUAL events, of the player's raw
//                              marks × that event's main-board scale factor.
//                              (i.e. the player's *scaled* contribution — what
//                              actually counts on the main board — so a team's
//                              players sum to the team's scaled event score.)
// ---------------------------------------------------------------------------

import type {
  Adjustment,
  Criterion,
  DataSnapshot,
  GameEvent,
  ID,
  Player,
  PlayerContribution,
  Score,
  Team,
  TeamEventScore,
  TeamStanding,
} from '../types'

export function round(value: number, dp: number): number {
  const f = Math.pow(10, dp)
  return Math.round((value + Number.EPSILON) * f) / f
}

/** Parse "HH:MM" or "HH:MM:SS" to seconds; null when unparseable. */
export function timeToSeconds(t: string | null | undefined): number | null {
  if (!t) return null
  const parts = t.split(':').map((p) => Number(p))
  if (parts.some((n) => Number.isNaN(n))) return null
  const [h = 0, m = 0, s = 0] = parts
  return h * 3600 + m * 60 + s
}

/** Duration between two "HH:MM(:SS)" values as a friendly string, or null. */
export function durationLabel(start: string | null, end: string | null): string | null {
  const a = timeToSeconds(start)
  const b = timeToSeconds(end)
  if (a == null || b == null) return null
  let diff = b - a
  if (diff < 0) diff += 24 * 3600 // crossed midnight
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function criteriaFor(criteria: Criterion[], eventId: ID): Criterion[] {
  return criteria
    .filter((c) => c.event_id === eventId)
    .sort((a, b) => a.order_index - b.order_index)
}

/** event_max = event_total, else sum of criteria max_marks, else null (unknown). */
export function eventMax(event: GameEvent, criteria: Criterion[]): number | null {
  if (event.event_total != null) return event.event_total
  const ecs = criteriaFor(criteria, event.id)
  const maxima = ecs.filter((c) => c.type !== 'time' && c.max_marks != null).map((c) => c.max_marks as number)
  if (maxima.length === 0) return null
  return maxima.reduce((a, b) => a + b, 0)
}

/**
 * Raw total for a team in an event = Σ number-criteria − Σ penalty-criteria.
 * `time` criteria are informational and never contribute.
 * For INDIVIDUAL events, every player's cell for that criterion is summed.
 */
export function teamRaw(
  event: GameEvent,
  criteria: Criterion[],
  scores: Score[],
): { raw: number; entered: boolean } {
  const ecs = criteriaFor(criteria, event.id)
  let raw = 0
  let entered = false
  for (const c of ecs) {
    if (c.type === 'time') continue
    const cellScores = scores.filter((s) => s.criterion_id === c.id && s.event_id === event.id)
    for (const s of cellScores) {
      if (s.value == null) continue
      entered = true
      raw += c.type === 'penalty' ? -Math.abs(s.value) : s.value
    }
  }
  return { raw, entered }
}

export function computeTeamEventScore(
  event: GameEvent,
  team: Team,
  criteria: Criterion[],
  scores: Score[],
  roundingDp: number,
): TeamEventScore {
  const teamScores = scores.filter((s) => s.event_id === event.id && s.team_id === team.id)
  const { raw, entered } = teamRaw(event, criteria, teamScores)
  const max = eventMax(event, criteria)
  const target = event.scale_to ?? max // COALESCE(scale_to, event_max)

  let scaled = raw
  let scaleApplied = false
  if (max != null && max > 0 && target != null) {
    scaled = raw * (target / max)
    scaleApplied = target !== max
  }
  return {
    team_id: team.id,
    event_id: event.id,
    raw: round(raw, roundingDp),
    eventMax: max,
    scaled: round(scaled, roundingDp),
    entered,
    scaleApplied,
  }
}

export function adjustmentsTotalFor(adjustments: Adjustment[], teamId: ID): number {
  return adjustments.filter((a) => a.team_id === teamId).reduce((sum, a) => sum + a.delta, 0)
}

/**
 * Full main-board standings, ranked. Tie-break: higher raw rubric-ish total,
 * then fewer total penalties (see spec §9.3) — implemented as: higher eventsTotal,
 * then fewer negative adjustments, then entry number.
 */
export function computeStandings(data: DataSnapshot): TeamStanding[] {
  const { teams, events, criteria, scores, adjustments, settings } = data
  const dp = settings.rounding_dp

  const standings: TeamStanding[] = teams.map((team) => {
    const eventScores: Record<ID, TeamEventScore> = {}
    let eventsTotal = 0
    for (const ev of events) {
      const tes = computeTeamEventScore(ev, team, criteria, scores, dp)
      eventScores[ev.id] = tes
      // Only finalized events... spec §9.1 says locked events feed the board;
      // drafts still show live but we include everything entered so the board is live.
      eventsTotal += tes.scaled
    }
    const adjustmentsTotal = adjustmentsTotalFor(adjustments, team.id)
    return {
      team,
      eventScores,
      eventsTotal: round(eventsTotal, dp),
      adjustmentsTotal: round(adjustmentsTotal, dp),
      total: round(eventsTotal + adjustmentsTotal, dp),
      rank: 0,
    }
  })

  standings.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (b.eventsTotal !== a.eventsTotal) return b.eventsTotal - a.eventsTotal
    // fewer penalties (less-negative adjustments) ranks higher
    const aPen = Math.min(0, a.adjustmentsTotal)
    const bPen = Math.min(0, b.adjustmentsTotal)
    if (bPen !== aPen) return bPen - aPen
    return a.team.entry_no.localeCompare(b.team.entry_no)
  })

  // dense-ish ranking with shared ranks for exact ties on total
  let lastTotal: number | null = null
  let lastRank = 0
  standings.forEach((s, i) => {
    if (lastTotal === null || s.total !== lastTotal) {
      lastRank = i + 1
      lastTotal = s.total
    }
    s.rank = lastRank
  })

  return standings
}

/** Which events are individually-scored (used by the contribution board). */
export function individualEvents(events: GameEvent[]): GameEvent[] {
  return events.filter((e) => e.scoring_method === 'INDIVIDUAL')
}

/**
 * A player's total individual contribution — measured the way the main board
 * counts it. For each INDIVIDUAL event we take the player's raw marks and apply
 * the SAME scale factor the main board uses for that event
 * (COALESCE(scale_to, event_max) / event_max). Summing all of a team's players
 * for an event therefore reproduces that team's scaled event score exactly,
 * so the individual leaderboard reconciles with the main scoreboard.
 *
 * When an event isn't scaled (scale_to unset or equal to event_max), the factor
 * is 1 and this reduces to the plain sum of raw marks.
 */
export function playerIndividualTotal(playerId: ID, events: GameEvent[], criteria: Criterion[], scores: Score[]): number {
  const critById = new Map(criteria.map((c) => [c.id, c]))
  let total = 0
  for (const ev of individualEvents(events)) {
    // raw marks this player contributed in this event (penalties subtract, time ignored)
    let raw = 0
    let contributed = false
    for (const s of scores) {
      if (s.player_id !== playerId) continue
      if (s.event_id !== ev.id) continue
      if (s.value == null) continue
      const crit = critById.get(s.criterion_id)
      if (!crit || crit.type === 'time') continue
      contributed = true
      raw += crit.type === 'penalty' ? -Math.abs(s.value) : s.value
    }
    if (!contributed) continue

    // Apply the main board's per-event scale factor (see computeTeamEventScore).
    const max = eventMax(ev, criteria)
    const target = ev.scale_to ?? max // COALESCE(scale_to, event_max)
    total += max != null && max > 0 && target != null ? raw * (target / max) : raw
  }
  return total
}

export function computeContributions(data: DataSnapshot): PlayerContribution[] {
  const { players, teams, events, criteria, scores } = data
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const rows: PlayerContribution[] = players
    .map((player) => {
      const team = teamById.get(player.team_id)
      if (!team) return null
      return {
        player,
        team,
        points: round(playerIndividualTotal(player.id, events, criteria, scores), data.settings.rounding_dp),
      }
    })
    .filter((r): r is PlayerContribution => r !== null)

  rows.sort((a, b) => b.points - a.points || a.player.name.localeCompare(b.player.name))
  return rows
}

export function playersFor(players: Player[], teamId: ID): Player[] {
  return players.filter((p) => p.team_id === teamId).sort((a, b) => a.order_index - b.order_index)
}

export function eventsInOrder(events: GameEvent[]): GameEvent[] {
  return [...events].sort((a, b) => a.order_index - b.order_index)
}

/**
 * Progression data: cumulative main-board total per team across events in order.
 * Returns rows [{ eventName, [teamName]: cumulativeTotal }] for Recharts.
 */
export function computeProgression(data: DataSnapshot): Array<Record<string, number | string>> {
  const { teams, criteria, scores, settings } = data
  const dp = settings.rounding_dp
  const events = eventsInOrder(data.events)

  const cumulative = new Map<ID, number>(teams.map((t) => [t.id, 0]))
  const rows: Array<Record<string, number | string>> = [
    { event: 'Start', ...Object.fromEntries(teams.map((t) => [t.name, 0])) },
  ]

  for (const ev of events) {
    for (const team of teams) {
      const tes = computeTeamEventScore(ev, team, criteria, scores, dp)
      cumulative.set(team.id, round((cumulative.get(team.id) ?? 0) + tes.scaled, dp))
    }
    const row: Record<string, number | string> = { event: ev.name }
    for (const team of teams) row[team.name] = cumulative.get(team.id) ?? 0
    rows.push(row)
  }
  return rows
}
