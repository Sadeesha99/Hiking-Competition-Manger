import { useMemo } from 'react'
import { useData } from '../../data/DataContext'
import { computeContributions, computeStandings, eventsInOrder } from '../../lib/scoring'
import { fmt, signed } from '../../lib/format'
import { FullPageLoader } from '../../components/ui'
import { GeneratedStamp, PrintHeader, PrintToolbar, usePrintTitle } from './PrintChrome'

export default function PrintAll() {
  const { state } = useData()
  usePrintTitle('HTC Poonagala 2026 — Full Results')

  const standings = useMemo(() => (state ? computeStandings(state) : []), [state])
  const contributions = useMemo(() => (state ? computeContributions(state) : []), [state])
  const events = useMemo(() => (state ? eventsInOrder(state.events) : []), [state])

  if (!state) return <FullPageLoader />

  return (
    <div className="print-container mx-auto max-w-4xl px-4 pb-10">
      <PrintToolbar />

      {/* 1. Main leaderboard */}
      <section>
        <PrintHeader title="Main Team Leaderboard" />
        <table className="print-table w-full text-sm">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Entry</th>
              <th className="text-left">Team</th>
              <th>Events</th>
              <th>Adjustments</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.team.id}>
                <td className="text-center">{s.rank}</td>
                <td className="text-center">{s.team.entry_no}</td>
                <td>{s.team.name}</td>
                <td className="text-center">{fmt(s.eventsTotal)}</td>
                <td className="text-center">{s.adjustmentsTotal === 0 ? '—' : signed(s.adjustmentsTotal)}</td>
                <td className="text-center font-bold">{fmt(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-600">Tie-break: {state.settings.tie_break_text}</p>
      </section>

      {/* 2. Individual leaderboard */}
      <section className="page-break">
        <PrintHeader title="Individual Contribution Leaderboard" />
        <table className="print-table w-full text-sm">
          <thead>
            <tr>
              <th>Rank</th>
              <th className="text-left">Player</th>
              <th className="text-left">Team</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {contributions.map((c, i) => (
              <tr key={c.player.id}>
                <td className="text-center">{i + 1}</td>
                <td>
                  {c.player.name}
                  {c.player.is_leader ? ' (Leader)' : ''}
                </td>
                <td>{c.team.name}</td>
                <td className="text-center">{fmt(c.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 3. Per-event summary */}
      <section className="page-break">
        <PrintHeader title="Per-Event Summary (scaled scores)" />
        <table className="print-table w-full text-xs">
          <thead>
            <tr>
              <th className="text-left">Team</th>
              {events.map((ev) => (
                <th key={ev.id} title={ev.name}>
                  {ev.order_index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.team.id}>
                <td>{s.team.name}</td>
                {events.map((ev) => (
                  <td key={ev.id} className="text-center">
                    {s.eventScores[ev.id]?.entered ? fmt(s.eventScores[ev.id].scaled) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <ol className="mt-3 grid grid-cols-2 gap-x-6 text-[11px] text-slate-600 sm:grid-cols-3">
          {events.map((ev) => (
            <li key={ev.id}>
              {ev.order_index + 1}. {ev.name}
            </li>
          ))}
        </ol>
      </section>

      {/* 4. Adjustments summary */}
      <section className="page-break">
        <PrintHeader title="Manual Adjustments" />
        {state.adjustments.length === 0 ? (
          <p className="text-sm text-slate-600">No manual adjustments recorded.</p>
        ) : (
          <table className="print-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Team</th>
                <th>Delta</th>
                <th className="text-left">Reason</th>
                <th>By</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {state.adjustments.map((a) => {
                const team = state.teams.find((t) => t.id === a.team_id)
                return (
                  <tr key={a.id}>
                    <td>{team?.name ?? '—'}</td>
                    <td className="text-center font-semibold">{signed(a.delta)}</td>
                    <td>{a.reason}</td>
                    <td className="text-center text-xs">{a.created_by ?? '—'}</td>
                    <td className="text-center text-xs">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <GeneratedStamp />
    </div>
  )
}
