import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/auth'
import { useData, useStore } from '../../data/DataContext'
import { playersFor } from '../../lib/scoring'
import type { Player, Team } from '../../types'
import { ConfirmDialog, EmptyState, Modal, useAction } from '../../components/ui'
import { Pencil, Plus, Printer, Trash, Users } from '../../components/icons'
import PageHeader from './PageHeader'

export default function Teams() {
  const { state } = useData()
  const store = useStore()
  const { user } = useAuth()
  const run = useAction()
  const actor = { email: user?.email ?? null }

  const [teamModal, setTeamModal] = useState<{ team?: Team } | null>(null)
  const [playerModal, setPlayerModal] = useState<{ teamId: string; player?: Player } | null>(null)
  const [confirmTeam, setConfirmTeam] = useState<Team | null>(null)
  const [confirmPlayer, setConfirmPlayer] = useState<Player | null>(null)

  const teams = useMemo(
    () => (state ? [...state.teams].sort((a, b) => a.entry_no.localeCompare(b.entry_no)) : []),
    [state],
  )

  if (!state) return null

  return (
    <div>
      <PageHeader
        title="Teams & Players"
        subtitle={`${teams.length} teams · ${state.players.length} players`}
        actions={
          <button className="btn-primary" onClick={() => setTeamModal({})}>
            <Plus className="h-4 w-4" /> Add team
          </button>
        }
      />

      {teams.length === 0 ? (
        <EmptyState title="No teams yet" hint="Add your first team to get started." icon={<Users className="h-10 w-10" />} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => {
            const players = playersFor(state.players, team.id)
            return (
              <div key={team.id} className="card flex flex-col p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="badge bg-slate-100 text-slate-600">#{team.entry_no}</span>
                      <h3 className="font-semibold text-slate-900">{team.name}</h3>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{players.length} players</p>
                  </div>
                  <div className="flex gap-1">
                    <Link className="btn-ghost p-1.5" to={`/admin/print/team/${team.id}`} title="Print team report" aria-label="Print team report">
                      <Printer className="h-4 w-4" />
                    </Link>
                    <button className="btn-ghost p-1.5" onClick={() => setTeamModal({ team })} aria-label="Edit team">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost p-1.5 text-red-600" onClick={() => setConfirmTeam(team)} aria-label="Delete team">
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <ul className="mb-3 flex-1 space-y-1">
                  {players.length === 0 && <li className="text-xs text-slate-400">No players yet.</li>}
                  {players.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm">
                      <span className="text-slate-700">
                        {p.name}
                        {p.is_leader && <span className="badge ml-1.5 bg-brand-100 text-brand-800">Leader</span>}
                      </span>
                      <span className="flex gap-0.5">
                        <button className="btn-ghost p-1" onClick={() => setPlayerModal({ teamId: team.id, player: p })} aria-label="Edit player">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-ghost p-1 text-red-600" onClick={() => setConfirmPlayer(p)} aria-label="Remove player">
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>

                <button className="btn-secondary w-full" onClick={() => setPlayerModal({ teamId: team.id })}>
                  <Plus className="h-4 w-4" /> Add player
                </button>
              </div>
            )
          })}
        </div>
      )}

      {teamModal && (
        <TeamModal
          team={teamModal.team}
          onClose={() => setTeamModal(null)}
          onSave={async (input) => {
            const ok = await run(
              () => (teamModal.team ? store.updateTeam(teamModal.team.id, input, actor) : store.createTeam(input, actor)),
              teamModal.team ? 'Team updated' : 'Team created',
            )
            if (ok) setTeamModal(null)
          }}
        />
      )}

      {playerModal && (
        <PlayerModal
          player={playerModal.player}
          onClose={() => setPlayerModal(null)}
          onSave={async (name, isLeader) => {
            const ok = await run(
              () =>
                playerModal.player
                  ? store.updatePlayer(playerModal.player.id, { name, is_leader: isLeader }, actor)
                  : store.addPlayer(playerModal.teamId, name, isLeader, actor),
              playerModal.player ? 'Player updated' : 'Player added',
            )
            if (ok) setPlayerModal(null)
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmTeam}
        onClose={() => setConfirmTeam(null)}
        onConfirm={() => confirmTeam && run(() => store.deleteTeam(confirmTeam.id, actor), 'Team deleted')}
        title="Delete team?"
        danger
        confirmLabel="Delete team"
        message={
          <>
            Delete <strong>{confirmTeam?.name}</strong> and all its players, scores and adjustments? This cannot be
            undone (the audit log keeps a record).
          </>
        }
      />
      <ConfirmDialog
        open={!!confirmPlayer}
        onClose={() => setConfirmPlayer(null)}
        onConfirm={() => confirmPlayer && run(() => store.deletePlayer(confirmPlayer.id, actor), 'Player removed')}
        title="Remove player?"
        danger
        confirmLabel="Remove"
        message={
          <>
            Remove <strong>{confirmPlayer?.name}</strong> and their individual scores?
          </>
        }
      />
    </div>
  )
}

function TeamModal({
  team,
  onClose,
  onSave,
}: {
  team?: Team
  onClose: () => void
  onSave: (input: { name: string; entry_no: string }) => void
}) {
  const [name, setName] = useState(team?.name ?? '')
  const [entryNo, setEntryNo] = useState(team?.entry_no ?? '')

  return (
    <Modal
      open
      onClose={onClose}
      title={team ? 'Edit team' : 'Add team'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => onSave({ name, entry_no: entryNo })} disabled={!name.trim() || !entryNo.trim()}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Team name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Entry number (In No)</label>
          <input
            className="input"
            value={entryNo}
            inputMode="numeric"
            placeholder="e.g. 01"
            onChange={(e) => setEntryNo(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">Must be unique across all teams.</p>
        </div>
      </div>
    </Modal>
  )
}

function PlayerModal({
  player,
  onClose,
  onSave,
}: {
  player?: Player
  onClose: () => void
  onSave: (name: string, isLeader: boolean) => void
}) {
  const [name, setName] = useState(player?.name ?? '')
  const [isLeader, setIsLeader] = useState(player?.is_leader ?? false)

  return (
    <Modal
      open
      onClose={onClose}
      title={player ? 'Edit player' : 'Add player'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => onSave(name, isLeader)} disabled={!name.trim()}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Player name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={isLeader} onChange={(e) => setIsLeader(e.target.checked)} />
          Team leader (optional — at most one per team)
        </label>
      </div>
    </Modal>
  )
}
