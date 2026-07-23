import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import {
  computeTeamEventScore,
  criteriaFor,
  durationLabel,
  eventMax,
  playersFor,
} from '../../lib/scoring'
import { fmt } from '../../lib/format'
import type { Criterion, Score, Team } from '../../types'
import { FullPageLoader } from '../../components/ui'
import { GeneratedStamp, PrintHeader, PrintToolbar, SignatureFooter, usePrintTitle } from './PrintChrome'

export default function PrintEvent() {
  const { id } = useParams()
  const { state } = useData()
  const [blank, setBlank] = useState(false)

  const event = state?.events.find((e) => e.id === id)
  const crits = useMemo(() => (state && event ? criteriaFor(state.criteria, event.id) : []), [state, event])
  const teams = useMemo(
    () => (state ? [...state.teams].sort((a, b) => a.entry_no.localeCompare(b.entry_no)) : []),
    [state],
  )

  usePrintTitle(event ? `Score Sheet — ${event.name}` : 'Score Sheet')

  if (!state) return <FullPageLoader />
  if (!event) return <div className="p-8 text-center text-slate-500">Event not found.</div>

  const max = eventMax(event, state.criteria)
  const timeCrits = crits.filter((c) => c.type === 'time')
  const numberCrits = crits.filter((c) => c.type === 'number')
  const penaltyCrits = crits.filter((c) => c.type === 'penalty')

  return (
    <div className="print-container mx-auto max-w-5xl px-4 pb-10">
      <PrintToolbar>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" className="h-4 w-4" checked={blank} onChange={(e) => setBlank(e.target.checked)} />
          Blank sheet
        </label>
      </PrintToolbar>

      <PrintHeader
        title={event.name}
        meta={
          <>
            {event.scoring_method === 'TEAM' ? 'Whole team' : 'Per player'} · Event max:{' '}
            {max == null ? '—' : fmt(max)} · Counts as: {fmt(event.scale_to ?? max ?? 0) || '—'}
            {blank && ' · BLANK'}
          </>
        }
      />

      {event.scoring_method === 'INDIVIDUAL' ? (
        <IndividualSheet event={event} teams={teams} numberCrits={numberCrits} penaltyCrits={penaltyCrits} scores={state.scores} players={state.players} blank={blank} />
      ) : (
        <TeamSheet
          event={event}
          teams={teams}
          timeCrits={timeCrits}
          numberCrits={numberCrits}
          penaltyCrits={penaltyCrits}
          scores={state.scores}
          blank={blank}
          computeScaled={(team) => computeTeamEventScore(event, team, state.criteria, state.scores, state.settings.rounding_dp)}
        />
      )}

      <SignatureFooter />
      <GeneratedStamp />
    </div>
  )
}

function cellScore(scores: Score[], eventId: string, critId: string, teamId: string, playerId: string | null): Score | undefined {
  return scores.find((s) => s.event_id === eventId && s.criterion_id === critId && s.team_id === teamId && (s.player_id ?? null) === playerId)
}

function TeamSheet({
  event,
  teams,
  timeCrits,
  numberCrits,
  penaltyCrits,
  scores,
  blank,
  computeScaled,
}: {
  event: { id: string; scale_to: number | null }
  teams: Team[]
  timeCrits: Criterion[]
  numberCrits: Criterion[]
  penaltyCrits: Criterion[]
  scores: Score[]
  blank: boolean
  computeScaled: (team: Team) => { raw: number; scaled: number; entered: boolean }
}) {
  return (
    <table className="print-table w-full text-sm">
      <thead>
        <tr>
          <th>In No</th>
          <th className="text-left">Team Name</th>
          {timeCrits.map((c) => (
            <th key={c.id} colSpan={3}>
              {c.name} (Start / End / Duration)
            </th>
          ))}
          {numberCrits.map((c) => (
            <th key={c.id}>{c.name}</th>
          ))}
          {penaltyCrits.map((c) => (
            <th key={c.id}>{c.name}</th>
          ))}
          <th>Raw</th>
          <th>Scaled</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((team) => {
          const tes = blank ? null : computeScaled(team)
          return (
            <tr key={team.id}>
              <td className="text-center">{team.entry_no}</td>
              <td>{team.name}</td>
              {timeCrits.map((c) => {
                const s = cellScore(scores, event.id, c.id, team.id, null)
                return blank ? (
                  <TripleBlank key={c.id} />
                ) : (
                  <ThreeCols key={c.id} start={s?.time_start ?? ''} end={s?.time_end ?? ''} duration={durationLabel(s?.time_start ?? null, s?.time_end ?? null) ?? ''} />
                )
              })}
              {numberCrits.map((c) => {
                const s = cellScore(scores, event.id, c.id, team.id, null)
                return <td key={c.id} className="text-center">{blank ? '' : s?.value ?? ''}</td>
              })}
              {penaltyCrits.map((c) => {
                const s = cellScore(scores, event.id, c.id, team.id, null)
                return <td key={c.id} className="text-center">{blank ? '' : s?.value ?? ''}</td>
              })}
              <td className="text-center font-semibold">{tes ? fmt(tes.raw) : ''}</td>
              <td className="text-center font-semibold">{tes ? fmt(tes.scaled) : ''}</td>
              <td />
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ThreeCols({ start, end, duration }: { start: string; end: string; duration: string }) {
  return (
    <>
      <td className="text-center">{start}</td>
      <td className="text-center">{end}</td>
      <td className="text-center">{duration}</td>
    </>
  )
}
function TripleBlank() {
  return (
    <>
      <td />
      <td />
      <td />
    </>
  )
}

function IndividualSheet({
  event,
  teams,
  numberCrits,
  penaltyCrits,
  scores,
  players,
  blank,
}: {
  event: { id: string }
  teams: Team[]
  numberCrits: Criterion[]
  penaltyCrits: Criterion[]
  scores: Score[]
  players: import('../../types').Player[]
  blank: boolean
}) {
  return (
    <table className="print-table w-full text-sm">
      <thead>
        <tr>
          <th>In No</th>
          <th className="text-left">Team Name</th>
          <th className="text-left">Participants' Scores</th>
          {penaltyCrits.map((c) => (
            <th key={c.id}>{c.name}</th>
          ))}
          <th>Total</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((team) => {
          const teamPlayers = playersFor(players, team.id)
          let total = 0
          const parts = teamPlayers.map((p) => {
            const vals = numberCrits.map((c) => {
              const s = cellScore(scores, event.id, c.id, team.id, p.id)
              if (!blank && s?.value != null) total += s.value
              return blank ? '' : s?.value ?? ''
            })
            return { player: p, values: vals }
          })
          for (const c of penaltyCrits) {
            const s = cellScore(scores, event.id, c.id, team.id, null)
            if (!blank && s?.value != null) total -= Math.abs(s.value)
          }
          return (
            <tr key={team.id}>
              <td className="text-center align-top">{team.entry_no}</td>
              <td className="align-top">{team.name}</td>
              <td className="align-top">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {parts.length === 0 && <span className="text-slate-400">—</span>}
                  {parts.map(({ player, values }) => (
                    <span key={player.id} className="inline-flex items-center gap-1">
                      {player.name}:
                      <span className="inline-block min-w-[2rem] border-b border-black text-center">
                        {values.join(' / ')}
                      </span>
                    </span>
                  ))}
                </div>
              </td>
              {penaltyCrits.map((c) => {
                const s = cellScore(scores, event.id, c.id, team.id, null)
                return <td key={c.id} className="text-center align-top">{blank ? '' : s?.value ?? ''}</td>
              })}
              <td className="text-center align-top font-semibold">{blank ? '' : fmt(total)}</td>
              <td className="align-top" />
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
