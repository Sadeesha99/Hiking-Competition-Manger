import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/auth'
import { useData, useStore } from '../../data/DataContext'
import {
  computeTeamEventScore,
  criteriaFor,
  durationLabel,
  eventMax,
  eventsInOrder,
  playersFor,
} from '../../lib/scoring'
import { fmt, timeAgo } from '../../lib/format'
import type { Criterion, GameEvent, ID, Player, Score, Team } from '../../types'
import { cx, EmptyState, useAction, useToast } from '../../components/ui'
import { Clipboard, Lock, Printer, Unlock } from '../../components/icons'
import { Link } from 'react-router-dom'
import PageHeader from './PageHeader'

export default function ScoreEntry() {
  const { state } = useData()
  const { eventId } = useParams()
  const navigate = useNavigate()

  const events = useMemo(() => (state ? eventsInOrder(state.events) : []), [state])
  const current = events.find((e) => e.id === eventId) ?? events[0]

  if (!state) return null

  if (events.length === 0) {
    return (
      <div>
        <PageHeader title="Score Entry" />
        <EmptyState title="No events to score" hint="Add events first." icon={<Clipboard className="h-10 w-10" />} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Score Entry"
        subtitle="Scores save automatically as you leave each field."
        actions={
          current && (
            <Link to={`/admin/print/event/${current.id}`} className="btn-secondary">
              <Printer className="h-4 w-4" /> Print sheet
            </Link>
          )
        }
      />

      <div className="mb-4">
        <label className="label">Event</label>
        <select
          className="input max-w-md"
          value={current?.id ?? ''}
          onChange={(e) => navigate(`/admin/score/${e.target.value}`)}
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name} · {ev.scoring_method === 'TEAM' ? 'team' : 'per player'} {ev.status === 'final' ? '(finalised)' : ''}
            </option>
          ))}
        </select>
      </div>

      {current && <EventScorer event={current} />}
    </div>
  )
}

function EventScorer({ event }: { event: GameEvent }) {
  const { state } = useData()
  const store = useStore()
  const { user } = useAuth()
  const run = useAction()
  const actor = { email: user?.email ?? null }

  const crits = useMemo(() => (state ? criteriaFor(state.criteria, event.id) : []), [state, event.id])
  const teams = useMemo(
    () => (state ? [...state.teams].sort((a, b) => a.entry_no.localeCompare(b.entry_no)) : []),
    [state],
  )
  if (!state) return null

  const locked = event.status === 'final'
  const max = eventMax(event, state.criteria)

  if (teams.length === 0) return <EmptyState title="No teams" hint="Add teams before scoring." />
  if (crits.length === 0) return <EmptyState title="No criteria" hint="Add criteria to this event first." />

  return (
    <div className="space-y-4">
      <div className={cx('flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm', locked ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-800')}>
        <span className="flex items-center gap-2">
          {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          {locked ? 'This event is finalised (locked). Unlock to edit.' : 'Draft — scores are editable and live on the board.'}
        </span>
        {locked ? (
          user?.role === 'super_admin' ? (
            <button className="btn-secondary" onClick={() => run(() => store.unlockEvent(event.id, actor), 'Event unlocked')}>
              <Unlock className="h-4 w-4" /> Unlock
            </button>
          ) : (
            <span className="text-xs">Ask a super-admin to unlock.</span>
          )
        ) : (
          <button className="btn-primary" onClick={() => run(() => store.finalizeEvent(event.id, actor), 'Event finalised')}>
            <Lock className="h-4 w-4" /> Finalise
          </button>
        )}
      </div>

      {teams.map((team) => (
        <TeamBlock key={team.id} team={team} event={event} crits={crits} scores={state.scores} players={playersFor(state.players, team.id)} locked={locked} max={max} />
      ))}
    </div>
  )
}

function TeamBlock({
  team,
  event,
  crits,
  scores,
  players,
  locked,
  max,
}: {
  team: Team
  event: GameEvent
  crits: Criterion[]
  scores: Score[]
  players: Player[]
  locked: boolean
  max: number | null
}) {
  const { state } = useData()
  const tes = state ? computeTeamEventScore(event, team, state.criteria, state.scores, state.settings.rounding_dp) : null

  const teamScores = scores.filter((s) => s.event_id === event.id && s.team_id === team.id)
  const lastEdit = teamScores.reduce<Score | null>((latest, s) => (!latest || s.updated_at > latest.updated_at ? s : latest), null)

  const numberCrits = crits.filter((c) => c.type === 'number')
  const otherCrits = crits.filter((c) => c.type !== 'number')

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">
            <span className="mr-1.5 text-slate-400">#{team.entry_no}</span>
            {team.name}
          </h3>
          {lastEdit?.updated_by && (
            <p className="text-[11px] text-slate-400">
              Last edited by {lastEdit.updated_by} · {timeAgo(lastEdit.updated_at)}
            </p>
          )}
        </div>
        <div className="text-right text-sm">
          <div className="tabular-nums">
            <span className="text-slate-400">Raw</span> <span className="font-semibold">{tes ? fmt(tes.raw) : '—'}</span>
            {tes && tes.scaleApplied && (
              <>
                <span className="mx-1 text-slate-300">→</span>
                <span className="text-slate-400">Scaled</span> <span className="font-bold text-brand-700">{fmt(tes.scaled)}</span>
              </>
            )}
          </div>
          {max != null && <div className="text-[11px] text-slate-400">out of {fmt(max)}</div>}
        </div>
      </div>

      {event.scoring_method === 'INDIVIDUAL' ? (
        <div className="space-y-3">
          {/* per-player number criteria */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-1 pr-2 font-medium">Player</th>
                  {numberCrits.map((c) => (
                    <th key={c.id} className="py-1 px-2 font-medium">
                      {c.name}
                      {c.max_marks != null && <span className="ml-1 text-slate-300">/{fmt(c.max_marks)}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.length === 0 && (
                  <tr>
                    <td colSpan={numberCrits.length + 1} className="py-2 text-xs text-slate-400">
                      No players in this team.
                    </td>
                  </tr>
                )}
                {players.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1 pr-2 text-slate-700">
                      {p.name}
                      {p.is_leader && <span className="ml-1 text-[10px] text-brand-600">★</span>}
                    </td>
                    {numberCrits.map((c) => (
                      <td key={c.id} className="py-1 px-1">
                        <NumberCell event={event} crit={c} team={team} player={p} scores={scores} locked={locked} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* team-level penalty / time criteria */}
          {otherCrits.length > 0 && (
            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
              {otherCrits.map((c) => (
                <CriterionField key={c.id} event={event} crit={c} team={team} player={null} scores={scores} locked={locked} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {crits.map((c) => (
            <CriterionField key={c.id} event={event} crit={c} team={team} player={null} scores={scores} locked={locked} />
          ))}
        </div>
      )}
    </div>
  )
}

function findScore(scores: Score[], eventId: ID, criterionId: ID, teamId: ID, playerId: ID | null): Score | undefined {
  return scores.find(
    (s) => s.event_id === eventId && s.criterion_id === criterionId && s.team_id === teamId && (s.player_id ?? null) === playerId,
  )
}

/** A labelled field that renders the right input for a criterion's type. */
function CriterionField({
  event,
  crit,
  team,
  player,
  scores,
  locked,
}: {
  event: GameEvent
  crit: Criterion
  team: Team
  player: Player | null
  scores: Score[]
  locked: boolean
}) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">
        {crit.name}
        {crit.type === 'penalty' && <span className="badge bg-red-100 text-[10px] text-red-700">−</span>}
        {crit.type === 'time' && <span className="badge bg-slate-200 text-[10px] text-slate-600">info</span>}
        {crit.max_marks != null && crit.type !== 'time' && <span className="text-xs font-normal text-slate-300">/{fmt(crit.max_marks)}</span>}
      </label>
      {crit.type === 'time' ? (
        <TimeCell event={event} crit={crit} team={team} player={player} scores={scores} locked={locked} />
      ) : (
        <NumberCell event={event} crit={crit} team={team} player={player} scores={scores} locked={locked} />
      )}
    </div>
  )
}

function NumberCell({
  event,
  crit,
  team,
  player,
  scores,
  locked,
}: {
  event: GameEvent
  crit: Criterion
  team: Team
  player: Player | null
  scores: Score[]
  locked: boolean
}) {
  const store = useStore()
  const { user } = useAuth()
  const { push } = useToast()
  const actor = { email: user?.email ?? null }
  const existing = findScore(scores, event.id, crit.id, team.id, player?.id ?? null)
  const [value, setValue] = useState(existing?.value != null ? String(existing.value) : '')

  // keep in sync if the underlying data changes (e.g. another judge / reset)
  useEffect(() => {
    setValue(existing?.value != null ? String(existing.value) : '')
  }, [existing?.value])

  async function commit() {
    const parsed = value.trim() === '' ? null : Number(value)
    if (parsed != null && Number.isNaN(parsed)) {
      push('Enter a valid number', 'error')
      setValue(existing?.value != null ? String(existing.value) : '')
      return
    }
    if ((existing?.value ?? null) === parsed) return
    try {
      await store.setScore({ event_id: event.id, criterion_id: crit.id, team_id: team.id, player_id: player?.id ?? null, value: parsed }, actor)
    } catch (e) {
      push(e instanceof Error ? e.message : 'Save failed — tap to retry', 'error')
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={cx('input text-center tabular-nums', crit.type === 'penalty' && 'border-red-200 focus:border-red-400 focus:ring-red-400')}
      value={value}
      disabled={locked}
      placeholder="—"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

function TimeCell({
  event,
  crit,
  team,
  player,
  scores,
  locked,
}: {
  event: GameEvent
  crit: Criterion
  team: Team
  player: Player | null
  scores: Score[]
  locked: boolean
}) {
  const store = useStore()
  const { user } = useAuth()
  const { push } = useToast()
  const actor = { email: user?.email ?? null }
  const existing = findScore(scores, event.id, crit.id, team.id, player?.id ?? null)
  const [start, setStart] = useState(existing?.time_start ?? '')
  const [end, setEnd] = useState(existing?.time_end ?? '')

  useEffect(() => {
    setStart(existing?.time_start ?? '')
    setEnd(existing?.time_end ?? '')
  }, [existing?.time_start, existing?.time_end])

  async function commit(nextStart: string, nextEnd: string) {
    if ((existing?.time_start ?? '') === nextStart && (existing?.time_end ?? '') === nextEnd) return
    try {
      await store.setScore(
        { event_id: event.id, criterion_id: crit.id, team_id: team.id, player_id: player?.id ?? null, value: null, time_start: nextStart || null, time_end: nextEnd || null },
        actor,
      )
    } catch (e) {
      push(e instanceof Error ? e.message : 'Save failed', 'error')
    }
  }

  const duration = durationLabel(start || null, end || null)

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="time"
        step={1}
        className="input px-2 py-1.5 text-sm"
        value={start}
        disabled={locked}
        onChange={(e) => setStart(e.target.value)}
        onBlur={() => commit(start, end)}
        aria-label="Start time"
      />
      <span className="text-slate-300">→</span>
      <input
        type="time"
        step={1}
        className="input px-2 py-1.5 text-sm"
        value={end}
        disabled={locked}
        onChange={(e) => setEnd(e.target.value)}
        onBlur={() => commit(start, end)}
        aria-label="End time"
      />
      <span className="ml-1 min-w-[3.5rem] text-xs tabular-nums text-slate-500">{duration ? `= ${duration}` : ''}</span>
    </div>
  )
}
