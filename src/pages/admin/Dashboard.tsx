import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import {
  computeContributions,
  computeProgression,
  computeStandings,
  eventsInOrder,
} from '../../lib/scoring'
import { fmt, downloadCSV, nowStamp } from '../../lib/format'
import { teamColor } from '../../lib/constants'
import { cx, EmptyState } from '../../components/ui'
import { ProgressionChart, SimpleBar, StandingsBar } from '../../components/charts'
import { ChartBar, Download, Printer } from '../../components/icons'
import PageHeader from './PageHeader'
import type { TeamStanding } from '../../types'

export default function Dashboard() {
  const { state, auditLog } = useData()
  const [breakdownEvent, setBreakdownEvent] = useState<string>('')

  const standings = useMemo(() => (state ? computeStandings(state) : []), [state])
  const contributions = useMemo(() => (state ? computeContributions(state) : []), [state])
  const progression = useMemo(() => (state ? computeProgression(state) : []), [state])
  const events = useMemo(() => (state ? eventsInOrder(state.events) : []), [state])

  if (!state) return null

  const scoredEvents = events.filter((ev) =>
    standings.some((s) => s.eventScores[ev.id]?.entered),
  ).length
  const leader = standings[0]
  const mover = biggestMover(progression, state.teams.map((t) => t.name))

  const selectedEvent = events.find((e) => e.id === breakdownEvent) ?? events[0]
  const breakdownData = selectedEvent
    ? standings
        .map((s) => ({ name: s.team.name, value: s.eventScores[selectedEvent.id]?.scaled ?? 0 }))
        .sort((a, b) => b.value - a.value)
    : []

  const topPlayers = contributions.slice(0, 10).map((c) => ({ name: c.player.name, value: c.points }))

  function exportScoreboard() {
    const rows = standings.map((s) => {
      const row: Record<string, unknown> = { Rank: s.rank, 'Entry No': s.team.entry_no, Team: s.team.name }
      for (const ev of events) row[ev.name] = s.eventScores[ev.id]?.entered ? s.eventScores[ev.id].scaled : ''
      row['Adjustments'] = s.adjustmentsTotal
      row['Total'] = s.total
      return row
    })
    downloadCSV(`htc-scoreboard-${stamp()}.csv`, rows)
  }

  function exportAudit() {
    const teamName = (id: string | null) => state!.teams.find((t) => t.id === id)?.name ?? ''
    const eventName = (id: string | null) => state!.events.find((e) => e.id === id)?.name ?? ''
    const rows = auditLog.map((l) => ({
      When: new Date(l.created_at).toLocaleString(),
      Actor: l.actor ?? '',
      Action: l.action,
      Entity: l.entity_type,
      Team: teamName(l.team_id),
      Event: eventName(l.event_id),
      Old: l.old_value != null ? JSON.stringify(l.old_value) : '',
      New: l.new_value != null ? JSON.stringify(l.new_value) : '',
      Reason: l.reason ?? '',
    }))
    downloadCSV(`htc-audit-log-${stamp()}.csv`, rows)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle={`Generated ${nowStamp()}`}
        actions={
          <>
            <button className="btn-secondary" onClick={exportScoreboard}>
              <Download className="h-4 w-4" /> Scoreboard CSV
            </button>
            <button className="btn-secondary" onClick={exportAudit}>
              <Download className="h-4 w-4" /> Audit CSV
            </button>
            <Link className="btn-primary" to="/admin/print/all">
              <Printer className="h-4 w-4" /> Print all
            </Link>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Teams" value={String(state.teams.length)} />
        <Kpi label="Events scored" value={`${scoredEvents} / ${events.length}`} />
        <Kpi label="Leading team" value={leader ? leader.team.name : '—'} sub={leader ? `${fmt(leader.total)} pts` : undefined} />
        <Kpi label="Biggest mover" value={mover?.name ?? '—'} sub={mover ? `+${fmt(mover.gain)} last event` : undefined} />
      </div>

      {state.teams.length === 0 ? (
        <EmptyState title="No teams yet" hint="Add teams and start scoring to populate the dashboard." icon={<ChartBar className="h-10 w-10" />} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Current standings">
              <StandingsBar data={standings.map((s, i) => ({ name: s.team.name, total: s.total, index: i }))} />
            </Card>
            <Card title="Progression by event">
              <ProgressionChart data={progression} teams={state.teams} />
            </Card>
          </div>

          {/* Completion matrix */}
          <Card title="Event completion matrix" subtitle="Grey = not entered · Amber = entered (draft) · Green = finalised">
            <CompletionMatrix standings={standings} events={events} />
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card
              title="Per-event breakdown"
              action={
                <select className="input max-w-[12rem] py-1.5 text-sm" value={selectedEvent?.id ?? ''} onChange={(e) => setBreakdownEvent(e.target.value)}>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              }
            >
              {breakdownData.length ? <SimpleBar data={breakdownData} vertical /> : <p className="text-sm text-slate-400">No data.</p>}
            </Card>
            <Card title="Top individual contributors">
              {topPlayers.length ? <SimpleBar data={topPlayers} color="#7c3aed" vertical /> : <p className="text-sm text-slate-400">No individual scores yet.</p>}
            </Card>
          </div>

          <Card title="Manual adjustments summary">
            <AdjustmentsSummary standings={standings} />
          </Card>
        </>
      )}
    </div>
  )
}

function stamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
}

function biggestMover(progression: Array<Record<string, number | string>>, teamNames: string[]): { name: string; gain: number } | null {
  if (progression.length < 2) return null
  const last = progression[progression.length - 1]
  const prev = progression[progression.length - 2]
  let best: { name: string; gain: number } | null = null
  for (const name of teamNames) {
    const gain = (Number(last[name]) || 0) - (Number(prev[name]) || 0)
    if (best === null || gain > best.gain) best = { name, gain }
  }
  return best && best.gain > 0 ? best : null
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function CompletionMatrix({ standings, events }: { standings: TeamStanding[]; events: ReturnType<typeof eventsInOrder> }) {
  const { state } = useData()
  if (!state) return null
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-medium text-slate-500">Team</th>
            {events.map((ev) => (
              <th key={ev.id} className="px-1 py-1 text-center font-medium text-slate-400" title={ev.name}>
                {ev.order_index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.team.id}>
              <td className="sticky left-0 z-10 bg-white px-2 py-1 font-medium text-slate-700">{s.team.name}</td>
              {events.map((ev) => {
                const es = s.eventScores[ev.id]
                const final = ev.status === 'final'
                const color = !es?.entered ? 'bg-slate-100 text-slate-300' : final ? 'bg-brand-500 text-white' : 'bg-amber-300 text-amber-900'
                return (
                  <td key={ev.id} className="p-0">
                    <div className={cx('flex h-7 w-9 items-center justify-center rounded tabular-nums', color)} title={`${s.team.name} · ${ev.name}`}>
                      {es?.entered ? fmt(es.scaled) : ''}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-400">Columns are events in order. Hover a cell for the event name.</p>
    </div>
  )
}

function AdjustmentsSummary({ standings }: { standings: TeamStanding[] }) {
  const rows = standings.filter((s) => s.adjustmentsTotal !== 0)
  if (rows.length === 0) return <p className="text-sm text-slate-400">No manual adjustments recorded.</p>
  return (
    <div className="space-y-2">
      {rows.map((s, i) => (
        <div key={s.team.id} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-slate-600">{s.team.name}</span>
          <div className="flex-1">
            <div className="h-4 rounded" style={{ width: `${Math.min(100, Math.abs(s.adjustmentsTotal) * 4)}%`, backgroundColor: s.adjustmentsTotal >= 0 ? teamColor(i) : '#dc2626' }} />
          </div>
          <span className={cx('w-14 text-right font-semibold tabular-nums', s.adjustmentsTotal >= 0 ? 'text-brand-700' : 'text-red-600')}>
            {s.adjustmentsTotal > 0 ? '+' : ''}
            {fmt(s.adjustmentsTotal)}
          </span>
        </div>
      ))}
    </div>
  )
}
