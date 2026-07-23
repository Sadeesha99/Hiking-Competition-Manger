import { useMemo, useState } from 'react'
import { useData } from '../../data/DataContext'
import { downloadCSV } from '../../lib/format'
import { EmptyState } from '../../components/ui'
import { Download, Search } from '../../components/icons'
import PageHeader from './PageHeader'

export default function AuditLog() {
  const { state, auditLog } = useData()
  const [team, setTeam] = useState('')
  const [event, setEvent] = useState('')
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [q, setQ] = useState('')
  const [date, setDate] = useState('')

  const actors = useMemo(() => Array.from(new Set(auditLog.map((l) => l.actor).filter(Boolean))) as string[], [auditLog])
  const actions = useMemo(() => Array.from(new Set(auditLog.map((l) => l.action))), [auditLog])

  const teamName = (id: string | null) => state?.teams.find((t) => t.id === id)?.name ?? ''
  const eventName = (id: string | null) => state?.events.find((e) => e.id === id)?.name ?? ''

  const filtered = useMemo(() => {
    return auditLog
      .filter((l) => (team ? l.team_id === team : true))
      .filter((l) => (event ? l.event_id === event : true))
      .filter((l) => (actor ? l.actor === actor : true))
      .filter((l) => (action ? l.action === action : true))
      .filter((l) => (date ? l.created_at.slice(0, 10) === date : true))
      .filter((l) => {
        if (!q.trim()) return true
        const hay = `${l.action} ${l.entity_type} ${teamName(l.team_id)} ${eventName(l.event_id)} ${l.reason ?? ''} ${JSON.stringify(l.old_value)} ${JSON.stringify(l.new_value)}`.toLowerCase()
        return hay.includes(q.toLowerCase())
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditLog, team, event, actor, action, date, q])

  if (!state) return null

  function exportCsv() {
    downloadCSV(
      `htc-audit-filtered.csv`,
      filtered.map((l) => ({
        When: new Date(l.created_at).toLocaleString(),
        Actor: l.actor ?? '',
        Action: l.action,
        Entity: l.entity_type,
        Team: teamName(l.team_id),
        Event: eventName(l.event_id),
        Old: l.old_value != null ? JSON.stringify(l.old_value) : '',
        New: l.new_value != null ? JSON.stringify(l.new_value) : '',
        Reason: l.reason ?? '',
      })),
    )
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle={`${filtered.length} of ${auditLog.length} entries · append-only`}
        actions={
          <button className="btn-secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <div className="card mb-4 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">All teams</option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="input" value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">All events</option>
            {state.events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
          <select className="input" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">All admins</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <input type="date" className="input lg:col-span-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No log entries" hint="Actions that change scores or data will appear here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">When</th>
                <th className="px-3 py-2.5">Actor</th>
                <th className="px-3 py-2.5">Action</th>
                <th className="px-3 py-2.5">Team / Event</th>
                <th className="px-3 py-2.5">Change</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{l.actor ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className="badge bg-slate-100 text-slate-700">{l.action}</span>
                    <span className="ml-1 text-xs text-slate-400">{l.entity_type}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {teamName(l.team_id) && <div>{teamName(l.team_id)}</div>}
                    {eventName(l.event_id) && <div className="text-slate-400">{eventName(l.event_id)}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {l.reason && <div className="mb-0.5 text-slate-700">{l.reason}</div>}
                    <ChangeCell oldValue={l.old_value} newValue={l.new_value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ChangeCell({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  const fmtVal = (v: unknown) => {
    if (v == null) return null
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>
      if ('value' in obj) return `value: ${obj.value ?? '—'}`
      return JSON.stringify(obj).slice(0, 80)
    }
    return String(v)
  }
  const o = fmtVal(oldValue)
  const n = fmtVal(newValue)
  if (!o && !n) return <span className="text-slate-300">—</span>
  return (
    <span className="font-mono text-[11px] text-slate-500">
      {o && <span className="text-red-500 line-through">{o}</span>}
      {o && n && <span className="mx-1">→</span>}
      {n && <span className="text-brand-700">{n}</span>}
    </span>
  )
}
