// ---------------------------------------------------------------------------
// Seed data — the 19 events and their criteria, taken from the paper score
// sheets (spec §3), plus default settings and optional demo teams/players.
//
// Everything here is fully editable at runtime by an admin; this is only the
// starting point (and what "Reset competition" restores).
// ---------------------------------------------------------------------------

import type {
  AppSettings,
  Criterion,
  CriterionType,
  GameEvent,
  Player,
  ScoringMethod,
  Team,
} from '../types'

export function newId(): string {
  // crypto.randomUUID is available in all modern browsers + Node 19+
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.abs(hashString(String(performance.now()) + Math.floor(performance.now()))).toString(36)
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

// A compact description of each event's scoring shape. `criteria` lists the
// score columns from the original sheet. `time` criteria are informational
// (start/end → auto duration); `penalty` criteria are subtracted; `number`
// criteria are added.
interface EventSpec {
  name: string
  method: ScoringMethod
  criteria: Array<{ name: string; type: CriterionType; max?: number | null }>
  event_total?: number | null
  scale_to?: number | null
}

// Shared shape for the eight time-based whole-team events.
const timeCriteria = (): EventSpec['criteria'] => [
  { name: 'Time', type: 'time', max: null },
  { name: 'Penalty', type: 'penalty', max: null },
  { name: 'Marks', type: 'number', max: 100 },
]

export const EVENT_SPECS: EventSpec[] = [
  // 1–8 — whole team, time based
  { name: 'Back Pack Run', method: 'TEAM', criteria: timeCriteria() },
  { name: 'Log Run', method: 'TEAM', criteria: timeCriteria() },
  { name: 'Team Endurance Run', method: 'TEAM', criteria: timeCriteria() },
  { name: 'Rope Climbing Challenge', method: 'TEAM', criteria: timeCriteria() },
  { name: 'Tent Pitching and Packing', method: 'TEAM', criteria: timeCriteria() },
  { name: 'Ball Pass', method: 'TEAM', criteria: timeCriteria() },
  { name: 'Team Bond Run', method: 'TEAM', criteria: timeCriteria() },
  { name: 'Ball Balance', method: 'TEAM', criteria: timeCriteria() },

  // 9–12 — per teammate (summed into a team score)
  {
    name: '2 min Pushup Challenge',
    method: 'INDIVIDUAL',
    criteria: [
      { name: 'Score', type: 'number', max: 20 },
      { name: 'Penalty', type: 'penalty', max: null },
    ],
    event_total: 120, // 20 per player × up to 6 players
    scale_to: 100, // demonstrates the scaling feature from the brief (§6)
  },
  {
    name: 'Navigation Challenge',
    method: 'INDIVIDUAL',
    criteria: [
      { name: 'Score', type: 'number', max: 20 },
      { name: 'Penalty', type: 'penalty', max: null },
    ],
    event_total: 120,
  },
  {
    name: 'Knot Tied',
    method: 'INDIVIDUAL',
    criteria: [
      { name: 'Score', type: 'number', max: 20 },
      { name: 'Penalty', type: 'penalty', max: null },
    ],
    event_total: 120,
  },
  {
    name: 'Writing Test',
    method: 'INDIVIDUAL',
    criteria: [{ name: 'Score', type: 'number', max: 20 }],
    event_total: 120,
  },

  // 13 — six emergency signals summed
  {
    name: 'Emergency Signaling',
    method: 'TEAM',
    criteria: [
      { name: 'Signal 01', type: 'number', max: 5 },
      { name: 'Signal 02', type: 'number', max: 5 },
      { name: 'Signal 03', type: 'number', max: 5 },
      { name: 'Signal 04', type: 'number', max: 5 },
      { name: 'Signal 05', type: 'number', max: 5 },
      { name: 'Signal 06', type: 'number', max: 5 },
    ],
  },

  // 14–16 — rubric events
  {
    name: 'Rescue Carry',
    method: 'TEAM',
    criteria: [
      { name: 'Safety', type: 'number', max: 10 },
      { name: 'Simplicity', type: 'number', max: 10 },
      { name: 'Accuracy', type: 'number', max: 10 },
      { name: 'Team Work', type: 'number', max: 10 },
    ],
  },
  {
    name: 'Scenario Challenge',
    method: 'TEAM',
    criteria: [
      { name: 'Safety', type: 'number', max: 10 },
      { name: 'Simplicity', type: 'number', max: 10 },
      { name: 'Accuracy', type: 'number', max: 10 },
      { name: 'Team Work', type: 'number', max: 10 },
      { name: 'Penalty', type: 'penalty', max: null },
    ],
  },
  {
    name: 'Stretcher Build',
    method: 'TEAM',
    criteria: [
      { name: 'Safety', type: 'number', max: 10 },
      { name: 'Simplicity', type: 'number', max: 10 },
      { name: 'Accuracy', type: 'number', max: 10 },
      { name: 'Team Work', type: 'number', max: 10 },
      { name: 'Penalty', type: 'penalty', max: null },
    ],
  },

  // 17–18 — per teammate
  {
    name: 'Identifying Medicines',
    method: 'INDIVIDUAL',
    criteria: [{ name: 'Score', type: 'number', max: 20 }],
    event_total: 120,
  },
  {
    name: 'Trail Observation',
    method: 'INDIVIDUAL',
    criteria: [{ name: 'Score', type: 'number', max: 20 }],
    event_total: 120,
  },

  // 19 — presentation rubric
  {
    name: 'Fun Presentation',
    method: 'TEAM',
    criteria: [
      { name: 'Presentation', type: 'number', max: 10 },
      { name: 'Team Work', type: 'number', max: 10 },
      { name: 'Communication Effectiveness', type: 'number', max: 10 },
      { name: 'Confidence', type: 'number', max: 10 },
    ],
  },
]

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  tie_break_text:
    'Ties are broken by (1) higher total across rubric events, then (2) fewer total penalties, then (3) lower entry number.',
  rounding_dp: 1,
}

export function buildEventsAndCriteria(): { events: GameEvent[]; criteria: Criterion[] } {
  const events: GameEvent[] = []
  const criteria: Criterion[] = []
  const now = new Date().toISOString()

  EVENT_SPECS.forEach((spec, i) => {
    const eventId = newId()
    events.push({
      id: eventId,
      name: spec.name,
      scoring_method: spec.method,
      event_total: spec.event_total ?? null,
      scale_to: spec.scale_to ?? null,
      status: 'draft',
      order_index: i,
      created_at: now,
    })
    spec.criteria.forEach((c, ci) => {
      criteria.push({
        id: newId(),
        event_id: eventId,
        name: c.name,
        type: c.type,
        max_marks: c.max ?? null,
        order_index: ci,
      })
    })
  })

  return { events, criteria }
}

// Demo teams/players so the app is explorable out of the box. An admin can
// delete these or use "Reset competition (no demo data)".
const DEMO_TEAMS = [
  { name: 'Trail Blazers', players: ['Nimal', 'Kamal', 'Sunil', 'Ruwan', 'Dilan', 'Kasun'] },
  { name: 'Summit Seekers', players: ['Amara', 'Ishara', 'Tharindu', 'Nadeesha', 'Praveen', 'Sanduni'] },
  { name: 'Ridge Runners', players: ['Chathura', 'Buddhi', 'Manoj', 'Hasitha', 'Gayan', 'Lahiru'] },
  { name: 'Peak Pioneers', players: ['Sachini', 'Dinesh', 'Nuwan', 'Malith', 'Yasas', 'Chamodi'] },
  { name: 'Boulder Crew', players: ['Roshan', 'Asela', 'Thilina', 'Janith', 'Sahan', 'Isuru'] },
  { name: 'Cloud Climbers', players: ['Nethmi', 'Oshadi', 'Vishwa', 'Damith', 'Sithara', 'Pasan'] },
]

export function buildDemoTeams(): { teams: Team[]; players: Player[] } {
  const teams: Team[] = []
  const players: Player[] = []
  const now = new Date().toISOString()

  DEMO_TEAMS.forEach((t, i) => {
    const teamId = newId()
    teams.push({
      id: teamId,
      name: t.name,
      entry_no: String(i + 1).padStart(2, '0'),
      created_at: now,
    })
    t.players.forEach((name, pi) => {
      players.push({
        id: newId(),
        team_id: teamId,
        name,
        is_leader: pi === 0, // first player is the team leader
        order_index: pi,
      })
    })
  })

  return { teams, players }
}
