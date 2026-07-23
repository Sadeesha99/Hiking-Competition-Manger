import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { computeStandings, eventsInOrder, playersFor } from '../../lib/scoring'
import { fmt, signed } from '../../lib/format'
import { FullPageLoader } from '../../components/ui'
import { GeneratedStamp, PrintHeader, PrintToolbar, usePrintTitle } from './PrintChrome'

export default function PrintTeam() {
  const { id } = useParams()
  const { state, auditLog } = useData()

  const team = state?.teams.find((t) => t.id === id)
  usePrintTitle(team ? `Team Report — ${team.name}` : 'Team Report')

  const standings = useMemo(() => (state ? computeStandings(state) : []), [state])
  const events = useMemo(() => (state ? eventsInOrder(state.events) : []), [state])

  if (!state) return <FullPageLoader />
  if (!team) return <div className="p-8 text-center text-slate-500">Team not found.</div>

  const standing = standings.find((s) => s.team.id === team.id)
  const players = playersFor(state.players, team.id)
  const teamAdjustments = state.adjustments.filter((a) => a.team_id === team.id)
  const teamLog = auditLog
    .filter((l) => l.team_id === team.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const eventName = (eid: string | null) => state.events.find((e) => e.id === eid)?.name ?? ''

  return (
    <div className="print-container mx-auto max-w-4xl px-4 pb-10">
      <PrintToolbar />

      <PrintHeader
        title={`Team Report — ${team.name}`}
        meta={
          <>
            Entry #{team.entry_no} · Current total: <strong>{standing ? fmt(standing.total) : '—'}</strong>
            {standing ? ` · Rank ${standing.rank}` : ''}
          </>
        }
      />

      {/* Players */}
      <section className="mb-5">
        <h3 className="mb-1 text-sm font-semibold">Players</h3>
        <p className="text-sm">
          {players.length === 0
            ? '—'
            : players.map((p) => `${p.name}${p.is_leader ? ' (Leader)' : ''}`).join(', ')}
        </p>
      </section>

      {/* Score breakdown by event */}
      <section className="mb-5">
        <h3 className="mb-1 text-sm font-semibold">Score breakdown by event</h3>
        <table className="print-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Event</th>
              <th>Raw</th>
              <th>Scaled</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const es = standing?.eventScores[ev.id]
              return (
                <tr key={ev.id}>
                  <td>{ev.name}</td>
                  <td className="text-center">{es?.entered ? fmt(es.raw) : '—'}</td>
                  <td className="text-center">{es?.entered ? fmt(es.scaled) : '—'}</td>
                </tr>
              )
            })}
            <tr>
              <td className="text-right font-semibold">Events total</td>
              <td />
              <td className="text-center font-bold">{standing ? fmt(standing.eventsTotal) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Adjustments */}
      <section className="mb-5">
        <h3 className="mb-1 text-sm font-semibold">Manual adjustments</h3>
        {teamAdjustments.length === 0 ? (
          <p className="text-sm text-slate-600">None.</p>
        ) : (
          <table className="print-table w-full text-sm">
            <thead>
              <tr>
                <th>Delta</th>
                <th className="text-left">Reason</th>
                <th>By</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {teamAdjustments.map((a) => (
                <tr key={a.id}>
                  <td className="text-center font-semibold">{signed(a.delta)}</td>
                  <td>{a.reason}</td>
                  <td className="text-center text-xs">{a.created_by ?? '—'}</td>
                  <td className="text-center text-xs">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Full audit trail */}
      <section className="page-break">
        <h3 className="mb-1 text-sm font-semibold">Audit trail</h3>
        {teamLog.length === 0 ? (
          <p className="text-sm text-slate-600">No log entries for this team.</p>
        ) : (
          <table className="print-table w-full text-xs">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Event</th>
                <th className="text-left">Change / Reason</th>
              </tr>
            </thead>
            <tbody>
              {teamLog.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.actor ?? '—'}</td>
                  <td>
                    {l.action} {l.entity_type}
                  </td>
                  <td>{eventName(l.event_id)}</td>
                  <td>
                    {l.reason ? l.reason + ' ' : ''}
                    {formatChange(l.old_value, l.new_value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <GeneratedStamp />
    </div>
  )
}

function formatChange(oldValue: unknown, newValue: unknown): string {
  const get = (v: unknown): string | null => {
    if (v == null) return null
    if (typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
      const val = (v as Record<string, unknown>).value
      return val == null ? '—' : String(val)
    }
    return null
  }
  const o = get(oldValue)
  const n = get(newValue)
  if (o == null && n == null) return ''
  return `${o ?? ''}${o != null && n != null ? ' → ' : ''}${n ?? ''}`
}
