import { useMemo, useState } from 'react'
import { useData } from '../../data/DataContext'
import {
  bestPlayersForEvent,
  captainContributions,
  computeStandings,
  finalizedIndividualEvents,
} from '../../lib/scoring'
import { fmt, downloadCSV, nowStamp } from '../../lib/format'
import { cx, EmptyState } from '../../components/ui'
import { ChevronDown, Download, FileText, Trophy } from '../../components/icons'
import PageHeader from './PageHeader'
import type { DataSnapshot, GameEvent, TeamStanding } from '../../types'

export default function Reports() {
  const { state } = useData()

  const indEvents = useMemo(() => (state ? finalizedIndividualEvents(state) : []), [state])
  const captains = useMemo(() => (state ? captainContributions(state) : []), [state])
  const standings = useMemo(() => (state ? computeStandings(state) : []), [state])
  const winners = useMemo(() => (state ? eventWinners(state, indEvents) : []), [state, indEvents])
  const split = useMemo(() => (state ? teamContributionSplit(state, standings) : []), [state, standings])

  // Report 1 — chosen event (falls back to the first finalised individual event).
  const [eventId, setEventId] = useState('')
  const selectedId = indEvents.some((e) => e.id === eventId) ? eventId : indEvents[0]?.id ?? ''
  const selectedEvent = indEvents.find((e) => e.id === selectedId)
  const bestPlayers = useMemo(
    () => (state && selectedId ? bestPlayersForEvent(state, selectedId) : []),
    [state, selectedId],
  )

  if (!state) return null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle={`Generated ${nowStamp()}`}
      />

      {/* ---------------------------------------------------------------- */}
      {/* 1 · Best player per event                                        */}
      {/* ---------------------------------------------------------------- */}
      <ReportCard
        n={1}
        title="Best player per event"
        subtitle="Top individual scorers in a finalised (locked) per-player event, by points contributed to the main board."
        action={
          indEvents.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() =>
                downloadCSV(
                  `htc-best-players-${slug(selectedEvent?.name)}-${stamp()}.csv`,
                  bestPlayers.map((r, i) => ({
                    Rank: i + 1,
                    Player: r.player.name,
                    Leader: r.player.is_leader ? 'Yes' : '',
                    Team: r.team.name,
                    'Raw marks': r.raw,
                    'Board points': r.scaled,
                  })),
                )
              }
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          )
        }
      >
        {indEvents.length === 0 ? (
          <EmptyState
            title="No finalised per-player events yet"
            hint="Finalise (lock) an individually-scored event to see its best players here."
          />
        ) : (
          <div className="space-y-3">
            <Select
              label="Event"
              value={selectedId}
              onChange={setEventId}
              options={indEvents.map((e) => ({ value: e.id, label: e.name }))}
            />
            {bestPlayers.length === 0 ? (
              <p className="text-sm text-slate-400">No player scores recorded for this event.</p>
            ) : (
              <Table head={['#', 'Player', 'Team', 'Board points']}>
                {bestPlayers.map((r, i) => (
                  <tr key={r.player.id} className="border-b border-slate-100">
                    <RankCell rank={i + 1} />
                    <td className="px-2 py-2.5">
                      <span className="font-medium text-slate-900">{r.player.name}</span>
                      {r.player.is_leader && <span className="badge ml-1.5 bg-brand-100 text-brand-800">Leader</span>}
                    </td>
                    <td className="px-2 py-2.5 text-slate-500">{r.team.name}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">
                      {fmt(r.scaled)}
                      {r.scaleApplied && <span className="ml-1 text-xs font-normal text-slate-400">(raw {fmt(r.raw)})</span>}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        )}
      </ReportCard>

      {/* ---------------------------------------------------------------- */}
      {/* 2 · Best team captains                                           */}
      {/* ---------------------------------------------------------------- */}
      <ReportCard
        n={2}
        title="Best team captains"
        subtitle="Team leaders ranked by the points they personally contributed to the main board in individually-scored events."
        action={
          captains.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() =>
                downloadCSV(
                  `htc-best-captains-${stamp()}.csv`,
                  captains.map((c, i) => ({
                    Rank: i + 1,
                    Captain: c.player.name,
                    Team: c.team.name,
                    'Entry No': c.team.entry_no,
                    'Board points': c.points,
                  })),
                )
              }
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          )
        }
      >
        {captains.length === 0 ? (
          <EmptyState
            title="No captain contributions yet"
            hint="Mark a player as leader and score some individual events to populate this."
          />
        ) : (
          <Table head={['#', 'Captain', 'Team', 'Board points']}>
            {captains.map((c, i) => (
              <tr key={c.player.id} className="border-b border-slate-100">
                <RankCell rank={i + 1} />
                <td className="px-2 py-2.5 font-medium text-slate-900">{c.player.name}</td>
                <td className="px-2 py-2.5 text-slate-500">
                  {c.team.name}
                  <span className="ml-1 text-xs text-slate-400">· Entry {c.team.entry_no}</span>
                </td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">{fmt(c.points)}</td>
              </tr>
            ))}
          </Table>
        )}
      </ReportCard>

      {/* ---------------------------------------------------------------- */}
      {/* 3 · Event winners overview                                       */}
      {/* ---------------------------------------------------------------- */}
      <ReportCard
        n={3}
        title="Event winners overview"
        subtitle="The single top contributor in every finalised per-player event — a one-glance summary."
        action={
          winners.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() =>
                downloadCSV(
                  `htc-event-winners-${stamp()}.csv`,
                  winners.map((w) => ({
                    Event: w.event.name,
                    'Top player': w.top?.player.name ?? '',
                    Team: w.top?.team.name ?? '',
                    'Board points': w.top ? w.top.scaled : '',
                  })),
                )
              }
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          )
        }
      >
        {winners.length === 0 ? (
          <EmptyState title="No finalised per-player events yet" hint="Winners appear once individual events are locked." />
        ) : (
          <Table head={['Event', 'Top player', 'Team', 'Board points']}>
            {winners.map((w) => (
              <tr key={w.event.id} className="border-b border-slate-100">
                <td className="px-3 py-2.5 font-medium text-slate-900">{w.event.name}</td>
                <td className="px-2 py-2.5">
                  {w.top ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      <span className="font-medium text-slate-900">{w.top.player.name}</span>
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-slate-500">{w.top?.team.name ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">
                  {w.top ? fmt(w.top.scaled) : '—'}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </ReportCard>

      {/* ---------------------------------------------------------------- */}
      {/* 4 · Team contribution split                                      */}
      {/* ---------------------------------------------------------------- */}
      <ReportCard
        n={4}
        title="Team contribution split"
        subtitle="How each team's main-board total breaks down: points from individual events vs team events vs manual adjustments."
        action={
          split.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() =>
                downloadCSV(
                  `htc-team-split-${stamp()}.csv`,
                  split.map((r) => ({
                    Team: r.team.name,
                    'Entry No': r.team.entry_no,
                    'Individual events': r.individual,
                    'Team events': r.team_events,
                    Adjustments: r.adjustments,
                    Total: r.total,
                  })),
                )
              }
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          )
        }
      >
        {split.length === 0 ? (
          <EmptyState title="No teams yet" hint="Add teams to see their contribution split." />
        ) : (
          <Table head={['Team', 'Individual', 'Team events', 'Adjustments', 'Total']}>
            {split.map((r) => (
              <tr key={r.team.id} className="border-b border-slate-100">
                <td className="px-3 py-2.5">
                  <span className="font-medium text-slate-900">{r.team.name}</span>
                  <span className="ml-1 text-xs text-slate-400">· Entry {r.team.entry_no}</span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{fmt(r.individual)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{fmt(r.team_events)}</td>
                <td
                  className={cx(
                    'px-2 py-2.5 text-right tabular-nums',
                    r.adjustments > 0 ? 'text-brand-700' : r.adjustments < 0 ? 'text-red-600' : 'text-slate-400',
                  )}
                >
                  {r.adjustments === 0 ? '—' : `${r.adjustments > 0 ? '+' : ''}${fmt(r.adjustments)}`}
                </td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">{fmt(r.total)}</td>
              </tr>
            ))}
          </Table>
        )}
      </ReportCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Derived data local to the Reports view
// ---------------------------------------------------------------------------

interface EventWinner {
  event: GameEvent
  top: ReturnType<typeof bestPlayersForEvent>[number] | null
}

function eventWinners(data: DataSnapshot, indEvents: GameEvent[]): EventWinner[] {
  return indEvents.map((event) => ({ event, top: bestPlayersForEvent(data, event.id)[0] ?? null }))
}

interface SplitRow {
  team: TeamStanding['team']
  individual: number
  team_events: number
  adjustments: number
  total: number
}

function teamContributionSplit(data: DataSnapshot, standings: TeamStanding[]): SplitRow[] {
  const methodById = new Map(data.events.map((e) => [e.id, e.scoring_method]))
  return standings.map((s) => {
    let individual = 0
    let team_events = 0
    for (const [eventId, es] of Object.entries(s.eventScores)) {
      if (!es.entered) continue
      if (methodById.get(eventId) === 'INDIVIDUAL') individual += es.scaled
      else team_events += es.scaled
    }
    return {
      team: s.team,
      individual: round2(individual),
      team_events: round2(team_events),
      adjustments: s.adjustmentsTotal,
      total: s.total,
    }
  })
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function ReportCard({
  n,
  title,
  subtitle,
  action,
  children,
}: {
  n: number
  title: string
  subtitle: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-800">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              {n}. {title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={h} className={cx('px-3 py-2.5', i === 0 ? 'w-12 text-center' : '', i === head.length - 1 ? 'text-right' : '')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function RankCell({ rank }: { rank: number }) {
  const medal =
    rank === 1 ? 'bg-amber-100 text-amber-800' : rank === 2 ? 'bg-slate-200 text-slate-700' : rank === 3 ? 'bg-orange-100 text-orange-800' : 'text-slate-500'
  return (
    <td className="px-3 py-2.5 text-center">
      <span className={cx('inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums', medal)}>
        {rank}
      </span>
    </td>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="relative block sm:max-w-sm">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 text-sm font-medium text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  )
}

function stamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
}

function slug(name: string | undefined): string {
  return (name ?? 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'
}
