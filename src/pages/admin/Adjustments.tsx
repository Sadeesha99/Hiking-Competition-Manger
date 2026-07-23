import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/auth'
import { useData, useStore } from '../../data/DataContext'
import { adjustmentsTotalFor } from '../../lib/scoring'
import { nowStamp, signed } from '../../lib/format'
import type { Team } from '../../types'
import { EmptyState, Modal, useAction } from '../../components/ui'
import { Plus, Trophy } from '../../components/icons'
import PageHeader from './PageHeader'

export default function Adjustments() {
  const { state } = useData()
  const store = useStore()
  const { user } = useAuth()
  const run = useAction()
  const actor = { email: user?.email ?? null }
  const [modalTeam, setModalTeam] = useState<Team | null>(null)

  const teams = useMemo(
    () => (state ? [...state.teams].sort((a, b) => a.entry_no.localeCompare(b.entry_no)) : []),
    [state],
  )
  if (!state) return null

  return (
    <div>
      <PageHeader title="Manual Adjustments" subtitle="Add or deduct points directly. A reason is always required and is logged." />

      {teams.length === 0 ? (
        <EmptyState title="No teams" hint="Add teams first." icon={<Trophy className="h-10 w-10" />} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {teams.map((team) => {
            const teamAdj = state.adjustments.filter((a) => a.team_id === team.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
            const total = adjustmentsTotalFor(state.adjustments, team.id)
            return (
              <div key={team.id} className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      <span className="mr-1.5 text-slate-400">#{team.entry_no}</span>
                      {team.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Net adjustment:{' '}
                      <span className={total > 0 ? 'text-brand-700' : total < 0 ? 'text-red-600' : 'text-slate-500'}>
                        {total === 0 ? '0' : signed(total)}
                      </span>
                    </p>
                  </div>
                  <button className="btn-secondary" onClick={() => setModalTeam(team)}>
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
                {teamAdj.length === 0 ? (
                  <p className="text-xs text-slate-400">No adjustments yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {teamAdj.map((a) => (
                      <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="text-slate-700">{a.reason}</p>
                          <p className="text-[11px] text-slate-400">
                            {a.created_by ?? 'admin'} · {new Date(a.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span className={`shrink-0 font-bold tabular-nums ${a.delta >= 0 ? 'text-brand-700' : 'text-red-600'}`}>
                          {signed(a.delta)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalTeam && (
        <AdjustmentModal
          team={modalTeam}
          onClose={() => setModalTeam(null)}
          onSave={async (delta, reason) => {
            const ok = await run(() => store.addAdjustment(modalTeam.id, delta, reason, actor), 'Adjustment saved')
            if (ok) setModalTeam(null)
          }}
        />
      )}
    </div>
  )
}

function AdjustmentModal({
  team,
  onClose,
  onSave,
}: {
  team: Team
  onClose: () => void
  onSave: (delta: number, reason: string) => void
}) {
  const [sign, setSign] = useState<1 | -1>(1)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const amt = Number(amount)
  const valid = amount.trim() !== '' && !Number.isNaN(amt) && amt > 0 && reason.trim() !== ''

  return (
    <Modal
      open
      onClose={onClose}
      title={`Adjust — ${team.name}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!valid} onClick={() => onSave(sign * amt, reason)}>
            Save adjustment
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Direction</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSign(1)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${sign === 1 ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-600'}`}
            >
              + Add points
            </button>
            <button
              type="button"
              onClick={() => setSign(-1)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${sign === -1 ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300 text-slate-600'}`}
            >
              − Deduct points
            </button>
          </div>
        </div>
        <div>
          <label className="label">Amount</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus placeholder="e.g. 10" />
        </div>
        <div>
          <label className="label">Reason (required)</label>
          <textarea
            className="input min-h-[72px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. −10 for late arrival to Log Run"
          />
          <p className="mt-1 text-xs text-slate-400">This preview: {sign === 1 ? '+' : '−'}{amount || '0'} · {nowStamp()}</p>
        </div>
      </div>
    </Modal>
  )
}
