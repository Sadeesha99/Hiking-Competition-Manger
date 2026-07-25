import { Fragment, useMemo, useState } from 'react'
import { useData } from '../../data/DataContext'
import {
  computeContributions,
  computeProgression,
  computeStandings,
  eventsInOrder,
  releasedEvents,
} from '../../lib/scoring'
import { fmt } from '../../lib/format'
import { cx, EmptyState, FullPageLoader, Spinner } from '../../components/ui'
import { ProgressionChart } from '../../components/charts'
import { ChartBar, ChevronDown, Flag, Trophy, Users } from '../../components/icons'

type Tab = 'teams' | 'players' | 'events' | 'progress'

export default function PublicLeaderboard() {
  const { state, loading } = useData()
  const [tab, setTab] = useState<Tab>('teams')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [eventId, setEventId] = useState<string>('')

  const standings = useMemo(() => (state ? computeStandings(state) : []), [state])
  const contributions = useMemo(() => (state ? computeContributions(state) : []), [state])
  // All events (used for the per-team breakdown) and the subset already released.
  const events = useMemo(() => (state ? eventsInOrder(state.events) : []), [state])
  const released = useMemo(() => (state ? releasedEvents(state) : []), [state])
  // Progression follows released events only, so the x-axis is one point per
  // released result rather than every configured (incl. draft/unscored) event.
  const progression = useMemo(() => (state ? computeProgression(state, released) : []), [state, released])

  // The event shown on the Events tab — the chosen one (if still released) or the first released one.
  const selectedEventId = released.some((e) => e.id === eventId) ? eventId : released[0]?.id ?? ''

  // Teams ranked by their scaled score in the selected event (entered first).
  const eventRows = useMemo(() => {
    if (!selectedEventId) return [] as Array<{ standing: (typeof standings)[number]; scaled: number; entered: boolean }>
    return standings
      .map((s) => {
        const es = s.eventScores[selectedEventId]
        return { standing: s, scaled: es?.scaled ?? 0, entered: !!es?.entered }
      })
      .sort((a, b) => {
        if (a.entered !== b.entered) return a.entered ? -1 : 1
        if (b.scaled !== a.scaled) return b.scaled - a.scaled
        return a.standing.team.entry_no.localeCompare(b.standing.team.entry_no)
      })
  }, [standings, selectedEventId])

  if (loading || !state) return <FullPageLoader label="Loading leaderboard…" />

  const hasTeams = standings.length > 0

  return (
    <div className="space-y-4">
      {/* segmented control */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-200/70 p-1 text-sm font-semibold">
        <TabButton active={tab === 'teams'} onClick={() => setTab('teams')} icon={<Trophy className="h-4 w-4" />}>
          Teams
        </TabButton>
        <TabButton active={tab === 'players'} onClick={() => setTab('players')} icon={<Users className="h-4 w-4" />}>
          Players
        </TabButton>
        <TabButton active={tab === 'events'} onClick={() => setTab('events')} icon={<Flag className="h-4 w-4" />}>
          Events
        </TabButton>
        <TabButton active={tab === 'progress'} onClick={() => setTab('progress')} icon={<ChartBar className="h-4 w-4" />}>
          Progress
        </TabButton>
      </div>

      <LiveBadge />

      {tab === 'teams' &&
        (!hasTeams ? (
          <EmptyState title="No teams yet" hint="Teams will appear here once the organisers add them." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-12 px-3 py-2.5 text-center">#</th>
                  <th className="px-2 py-2.5">Team</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="w-8 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => {
                  const isOpen = expanded === s.team.id
                  return (
                    <Fragment key={s.team.id}>
                      <tr
                        className={cx('cursor-pointer border-b border-slate-100 hover:bg-slate-50', isOpen && 'bg-brand-50/50')}
                        onClick={() => setExpanded(isOpen ? null : s.team.id)}
                      >
                        <td className="px-3 py-3 text-center">
                          <RankPill rank={s.rank} />
                        </td>
                        <td className="px-2 py-3">
                          <div className="font-semibold text-slate-900">{s.team.name}</div>
                          <div className="text-xs text-slate-400">Entry {s.team.entry_no}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-900">{fmt(s.total)}</td>
                        <td className="px-2 py-3 text-slate-400">
                          <ChevronDown className={cx('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={4} className="px-3 py-3">
                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                              {events.map((ev) => {
                                const es = s.eventScores[ev.id]
                                return (
                                  <div
                                    key={ev.id}
                                    className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-xs"
                                  >
                                    <span className="truncate text-slate-600">{ev.name}</span>
                                    <span className={cx('ml-2 font-semibold tabular-nums', es?.entered ? 'text-slate-900' : 'text-slate-300')}>
                                      {es?.entered ? fmt(es.scaled) : '—'}
                                    </span>
                                  </div>
                                )
                              })}
                              {s.adjustmentsTotal !== 0 && (
                                <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-1.5 text-xs">
                                  <span className="text-amber-700">Manual adjustments</span>
                                  <span className="ml-2 font-semibold tabular-nums text-amber-800">
                                    {s.adjustmentsTotal > 0 ? '+' : ''}
                                    {fmt(s.adjustmentsTotal)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">{state.settings.tie_break_text}</p>
          </div>
        ))}

      {tab === 'players' &&
        (contributions.length === 0 ? (
          <EmptyState title="No players yet" hint="Individual contributions from Pushup, Navigation, Knot, Writing, Medicines and Trail Observation appear here." />
        ) : (
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
              Points from individually-scored events only.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-12 px-3 py-2.5 text-center">#</th>
                  <th className="px-2 py-2.5">Player</th>
                  <th className="px-2 py-2.5">Team</th>
                  <th className="px-3 py-2.5 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c, i) => (
                  <tr key={c.player.id} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 text-center text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2.5 font-medium text-slate-900">
                      {c.player.name}
                      {c.player.is_leader && <span className="badge ml-1.5 bg-brand-100 text-brand-800">Leader</span>}
                    </td>
                    <td className="px-2 py-2.5 text-slate-500">{c.team.name}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt(c.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'events' &&
        (released.length === 0 ? (
          <EmptyState title="No results released yet" hint="An event's team scores appear here once the organisers finalise and release it." />
        ) : (
          <div className="space-y-3">
            <div className="card p-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">Game event</label>
                <span className="badge bg-brand-100 text-brand-800">
                  {released.length} {released.length === 1 ? 'event' : 'events'} released
                </span>
              </div>
              <div className="relative">
                <select
                  value={selectedEventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 text-sm font-medium text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {released.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                Score each team counts on the main board for this event.
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="w-12 px-3 py-2.5 text-center">#</th>
                    <th className="px-2 py-2.5">Team</th>
                    <th className="px-3 py-2.5 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRows.map((row, i) => (
                    <tr key={row.standing.team.id} className="border-b border-slate-100">
                      <td className="px-3 py-2.5 text-center">
                        {row.entered ? <RankPill rank={i + 1} /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="font-medium text-slate-900">{row.standing.team.name}</div>
                        <div className="text-xs text-slate-400">Entry {row.standing.team.entry_no}</div>
                      </td>
                      <td
                        className={cx(
                          'px-3 py-2.5 text-right font-bold tabular-nums',
                          row.entered ? 'text-slate-900' : 'text-slate-300',
                        )}
                      >
                        {row.entered ? fmt(row.scaled) : 'Not scored'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {tab === 'progress' &&
        (released.length === 0 ? (
          <EmptyState title="No results released yet" hint="The progression chart fills in as each event's scores are released." />
        ) : (
          <div className="card p-3 sm:p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Cumulative score by released event</h2>
            <ProgressionChart data={progression} teams={state.teams} height={340} />
          </div>
        ))}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 transition-colors',
        active ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function RankPill({ rank }: { rank: number }) {
  const medal =
    rank === 1 ? 'bg-amber-100 text-amber-800' : rank === 2 ? 'bg-slate-200 text-slate-700' : rank === 3 ? 'bg-orange-100 text-orange-800' : 'text-slate-500'
  return (
    <span className={cx('inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums', medal)}>
      {rank}
    </span>
  )
}

function LiveBadge() {
  const { loading } = useData()
  return (
    <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-400">
      {loading ? <Spinner className="h-3 w-3" /> : <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />}
      Live · auto-updates
    </div>
  )
}
