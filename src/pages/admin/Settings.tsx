import { useState } from 'react'
import { useAuth } from '../../auth/auth'
import { useData, useStore } from '../../data/DataContext'
import type { UserRole } from '../../types'
import { ConfirmDialog, useAction } from '../../components/ui'
import { Cog, Plus, Trash } from '../../components/icons'
import PageHeader from './PageHeader'

export default function Settings() {
  const { state } = useData()
  const store = useStore()
  const { user, mode, listAccounts, addAccount, removeAccount } = useAuth()
  const run = useAction()
  const actor = { email: user?.email ?? null }

  const isSuper = user?.role === 'super_admin'

  const [tieBreak, setTieBreak] = useState(state?.settings.tie_break_text ?? '')
  const [rounding, setRounding] = useState(String(state?.settings.rounding_dp ?? 1))
  const [resetOpen, setResetOpen] = useState<false | 'demo' | 'empty'>(false)

  // local-only user mgmt
  const [accounts, setAccounts] = useState(() => (mode === 'local' ? listAccounts() : []))
  const [newEmail, setNewEmail] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('judge')
  const refreshAccounts = () => setAccounts(listAccounts())

  if (!state) return null

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle={`${mode === 'local' ? 'Demo (local) mode' : 'Supabase mode'}`} />

      {/* Scoring settings */}
      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
          <Cog className="h-5 w-5 text-slate-400" /> Scoring & display
        </h2>
        <div className="space-y-3">
          <div>
            <label className="label">Tie-break rule (shown publicly)</label>
            <textarea className="input min-h-[72px]" value={tieBreak} onChange={(e) => setTieBreak(e.target.value)} />
          </div>
          <div>
            <label className="label">Rounding — decimal places for scaled scores</label>
            <select className="input max-w-[10rem]" value={rounding} onChange={(e) => setRounding(e.target.value)}>
              {[0, 1, 2].map((n) => (
                <option key={n} value={n}>
                  {n} dp
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn-primary"
            onClick={() => run(() => store.updateSettings({ tie_break_text: tieBreak, rounding_dp: Number(rounding) }, actor), 'Settings saved')}
          >
            Save settings
          </button>
        </div>
      </section>

      {/* Admin accounts */}
      <section className="card p-5">
        <h2 className="mb-1 font-semibold text-slate-900">Admin accounts</h2>
        {mode === 'supabase' ? (
          <p className="text-sm text-slate-500">
            Manage admin/judge accounts in the <strong>Supabase dashboard → Authentication → Users</strong>. Set the
            super-admin email via the <code className="font-mono text-xs">VITE_SUPER_ADMIN_EMAIL</code> environment
            variable.
          </p>
        ) : !isSuper ? (
          <p className="text-sm text-slate-500">Only a super-admin can manage accounts.</p>
        ) : (
          <div className="space-y-3">
            <ul className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <li key={a.email} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-700">{a.email}</span>
                    <span className="badge ml-2 bg-slate-100 text-slate-600">{a.role === 'super_admin' ? 'Super admin' : 'Judge'}</span>
                  </span>
                  {a.role !== 'super_admin' && (
                    <button
                      className="btn-ghost p-1.5 text-red-600"
                      onClick={() => {
                        try {
                          removeAccount(a.email)
                          refreshAccounts()
                        } catch (e) {
                          alert(e instanceof Error ? e.message : 'Failed')
                        }
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input className="input sm:col-span-2" placeholder="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <input className="input" placeholder="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
              <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
                <option value="judge">Judge</option>
                <option value="super_admin">Super admin</option>
              </select>
            </div>
            <button
              className="btn-secondary"
              disabled={!newEmail.trim() || !newPass.trim()}
              onClick={() => {
                try {
                  addAccount(newEmail, newPass, newRole)
                  setNewEmail('')
                  setNewPass('')
                  refreshAccounts()
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Failed')
                }
              }}
            >
              <Plus className="h-4 w-4" /> Add account
            </button>
            <p className="text-xs text-amber-700">Demo mode stores passwords in this browser only — do not use real passwords.</p>
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="card border-red-200 p-5">
        <h2 className="mb-1 font-semibold text-red-700">Reset competition</h2>
        <p className="mb-3 text-sm text-slate-500">
          Restores the 19 default events and clears all scores. The audit log is preserved. {!isSuper && 'Super-admin only.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-danger" disabled={!isSuper} onClick={() => setResetOpen('demo')}>
            Reset with demo teams
          </button>
          <button className="btn-secondary" disabled={!isSuper} onClick={() => setResetOpen('empty')}>
            Reset with no teams
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={resetOpen !== false}
        onClose={() => setResetOpen(false)}
        onConfirm={() => run(() => store.resetCompetition(actor, resetOpen === 'demo'), 'Competition reset')}
        title="Reset the competition?"
        danger
        confirmLabel="Yes, reset"
        message="This clears all teams' scores and restores default events. This cannot be undone."
      />
    </div>
  )
}
