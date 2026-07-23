import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/auth'
import { useData, useStore } from '../../data/DataContext'
import { criteriaFor, eventMax, eventsInOrder } from '../../lib/scoring'
import { fmt } from '../../lib/format'
import type { Criterion, CriterionType, GameEvent, ScoringMethod } from '../../types'
import { cx, ConfirmDialog, EmptyState, Modal, useAction } from '../../components/ui'
import { Clipboard, Flag, Lock, Pencil, Plus, Printer, Trash, Unlock } from '../../components/icons'
import PageHeader from './PageHeader'

const TYPE_LABEL: Record<CriterionType, string> = {
  number: 'Mark',
  time: 'Time (info)',
  penalty: 'Penalty (−)',
}

export default function Events() {
  const { state } = useData()
  const store = useStore()
  const { user } = useAuth()
  const run = useAction()
  const actor = { email: user?.email ?? null }

  const [eventModal, setEventModal] = useState<{ event?: GameEvent } | null>(null)
  const [critModal, setCritModal] = useState<{ eventId: string; crit?: Criterion } | null>(null)
  const [confirmEvent, setConfirmEvent] = useState<GameEvent | null>(null)
  const [confirmCrit, setConfirmCrit] = useState<Criterion | null>(null)

  const events = useMemo(() => (state ? eventsInOrder(state.events) : []), [state])
  if (!state) return null

  return (
    <div>
      <PageHeader
        title="Events & Criteria"
        subtitle={`${events.length} events`}
        actions={
          <button className="btn-primary" onClick={() => setEventModal({})}>
            <Plus className="h-4 w-4" /> Add event
          </button>
        }
      />

      {events.length === 0 ? (
        <EmptyState title="No events" hint="Add events, or reset the competition to load the 19 default events." icon={<Flag className="h-10 w-10" />} />
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const crits = criteriaFor(state.criteria, ev.id)
            const max = eventMax(ev, state.criteria)
            const effectiveScale = ev.scale_to ?? max
            const scaleWarning = ev.scale_to != null && max == null
            return (
              <div key={ev.id} className="card overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{ev.name}</h3>
                      <span className={cx('badge', ev.scoring_method === 'TEAM' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700')}>
                        {ev.scoring_method === 'TEAM' ? 'Whole team' : 'Per player'}
                      </span>
                      <span className={cx('badge', ev.status === 'final' ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-800')}>
                        {ev.status === 'final' ? 'Finalised' : 'Draft'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Event max: <strong>{max == null ? 'not set' : fmt(max)}</strong> · Counts on board as:{' '}
                      <strong>{effectiveScale == null ? 'not set' : fmt(effectiveScale)}</strong>
                      {ev.scale_to != null && max != null && ev.scale_to !== max && (
                        <span className="ml-1 text-brand-700">(scaled)</span>
                      )}
                    </p>
                    {scaleWarning && (
                      <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        Scaling is set but the event max is unknown — set an event total or criteria max marks, or scaling
                        won't apply.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Link to={`/admin/score/${ev.id}`} className="btn-secondary" title="Enter scores">
                      <Clipboard className="h-4 w-4" /> Score
                    </Link>
                    <Link to={`/admin/print/event/${ev.id}`} className="btn-ghost p-2" title="Print score sheet">
                      <Printer className="h-4 w-4" />
                    </Link>
                    {ev.status === 'draft' ? (
                      <button className="btn-ghost p-2" title="Finalise (lock)" onClick={() => run(() => store.finalizeEvent(ev.id, actor), 'Event finalised')}>
                        <Lock className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        className="btn-ghost p-2 text-amber-600"
                        title={user?.role === 'super_admin' ? 'Unlock' : 'Only a super-admin can unlock'}
                        disabled={user?.role !== 'super_admin'}
                        onClick={() => run(() => store.unlockEvent(ev.id, actor), 'Event unlocked')}
                      >
                        <Unlock className="h-4 w-4" />
                      </button>
                    )}
                    <button className="btn-ghost p-2" title="Edit event" onClick={() => setEventModal({ event: ev })}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost p-2 text-red-600" title="Delete event" onClick={() => setConfirmEvent(ev)}>
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Criteria</h4>
                    <button className="btn-ghost text-brand-700" onClick={() => setCritModal({ eventId: ev.id })}>
                      <Plus className="h-4 w-4" /> Add criterion
                    </button>
                  </div>
                  {crits.length === 0 ? (
                    <p className="text-xs text-slate-400">No criteria yet — add at least one.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {crits.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm">
                          <span className="font-medium text-slate-700">{c.name}</span>
                          <span className={cx('badge text-[10px]', c.type === 'penalty' ? 'bg-red-100 text-red-700' : c.type === 'time' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700')}>
                            {TYPE_LABEL[c.type]}
                          </span>
                          {c.max_marks != null && <span className="text-xs text-slate-400">max {fmt(c.max_marks)}</span>}
                          <button className="text-slate-400 hover:text-slate-700" onClick={() => setCritModal({ eventId: ev.id, crit: c })} aria-label="Edit criterion">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button className="text-slate-400 hover:text-red-600" onClick={() => setConfirmCrit(c)} aria-label="Delete criterion">
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {eventModal && (
        <EventModal
          event={eventModal.event}
          onClose={() => setEventModal(null)}
          onSave={async (input) => {
            const ok = await run(
              () =>
                eventModal.event
                  ? store.updateEvent(eventModal.event.id, input, actor)
                  : store.createEvent({ name: input.name, scoring_method: input.scoring_method }, actor),
              eventModal.event ? 'Event updated' : 'Event created',
            )
            if (ok) setEventModal(null)
          }}
        />
      )}

      {critModal && (
        <CriterionModal
          crit={critModal.crit}
          onClose={() => setCritModal(null)}
          onSave={async (input) => {
            const ok = await run(
              () =>
                critModal.crit
                  ? store.updateCriterion(critModal.crit.id, input, actor)
                  : store.addCriterion(critModal.eventId, input, actor),
              critModal.crit ? 'Criterion updated' : 'Criterion added',
            )
            if (ok) setCritModal(null)
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmEvent}
        onClose={() => setConfirmEvent(null)}
        onConfirm={() => confirmEvent && run(() => store.deleteEvent(confirmEvent.id, actor), 'Event deleted')}
        title="Delete event?"
        danger
        confirmLabel="Delete event"
        message={
          <>
            Delete <strong>{confirmEvent?.name}</strong>, its criteria and all its scores?
          </>
        }
      />
      <ConfirmDialog
        open={!!confirmCrit}
        onClose={() => setConfirmCrit(null)}
        onConfirm={() => confirmCrit && run(() => store.deleteCriterion(confirmCrit.id, actor), 'Criterion deleted')}
        title="Delete criterion?"
        danger
        confirmLabel="Delete"
        message={
          <>
            Delete <strong>{confirmCrit?.name}</strong> and its scores?
          </>
        }
      />
    </div>
  )
}

function EventModal({
  event,
  onClose,
  onSave,
}: {
  event?: GameEvent
  onClose: () => void
  onSave: (input: { name: string; scoring_method: ScoringMethod; event_total: number | null; scale_to: number | null }) => void
}) {
  const [name, setName] = useState(event?.name ?? '')
  const [method, setMethod] = useState<ScoringMethod>(event?.scoring_method ?? 'TEAM')
  const [eventTotal, setEventTotal] = useState(event?.event_total != null ? String(event.event_total) : '')
  const [scaleTo, setScaleTo] = useState(event?.scale_to != null ? String(event.scale_to) : '')

  const parse = (s: string) => (s.trim() === '' ? null : Number(s))

  return (
    <Modal
      open
      onClose={onClose}
      title={event ? 'Edit event' : 'Add event'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!name.trim()}
            onClick={() => onSave({ name, scoring_method: method, event_total: parse(eventTotal), scale_to: parse(scaleTo) })}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Event name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Scoring method</label>
          <div className="grid grid-cols-2 gap-2">
            {(['TEAM', 'INDIVIDUAL'] as ScoringMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cx(
                  'rounded-lg border px-3 py-2 text-sm font-medium',
                  method === m ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-600',
                )}
              >
                {m === 'TEAM' ? 'Whole team' : 'Per player'}
              </button>
            ))}
          </div>
        </div>
        {event && (
          <>
            <div>
              <label className="label">Event total marks (optional)</label>
              <input className="input" inputMode="decimal" value={eventTotal} placeholder="defaults to sum of criteria max" onChange={(e) => setEventTotal(e.target.value)} />
            </div>
            <div>
              <label className="label">Counts on main board as / scale to (optional)</label>
              <input className="input" inputMode="decimal" value={scaleTo} placeholder="defaults to event total (no scaling)" onChange={(e) => setScaleTo(e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">
                e.g. an event out of 120 that should count as 100 → enter 100. Leaving this blank means no scaling.
              </p>
            </div>
          </>
        )}
        {!event && <p className="text-xs text-slate-400">You can set totals, scaling and criteria after creating the event.</p>}
      </div>
    </Modal>
  )
}

function CriterionModal({
  crit,
  onClose,
  onSave,
}: {
  crit?: Criterion
  onClose: () => void
  onSave: (input: { name: string; type: CriterionType; max_marks: number | null }) => void
}) {
  const [name, setName] = useState(crit?.name ?? '')
  const [type, setType] = useState<CriterionType>(crit?.type ?? 'number')
  const [maxMarks, setMaxMarks] = useState(crit?.max_marks != null ? String(crit.max_marks) : '')

  return (
    <Modal
      open
      onClose={onClose}
      title={crit ? 'Edit criterion' : 'Add criterion'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!name.trim()}
            onClick={() => onSave({ name, type, max_marks: maxMarks.trim() === '' ? null : Number(maxMarks) })}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Criterion name</label>
          <input className="input" value={name} placeholder="e.g. Safety, Marks, Signal 01" onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['number', 'time', 'penalty'] as CriterionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cx(
                  'rounded-lg border px-2 py-2 text-xs font-medium',
                  type === t ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-600',
                )}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {type === 'number' && 'A mark that is added to the total.'}
            {type === 'time' && 'Start/End times → auto duration. Informational only; not added to the score.'}
            {type === 'penalty' && 'A value that is subtracted from the total.'}
          </p>
        </div>
        {type !== 'time' && (
          <div>
            <label className="label">Max marks (optional)</label>
            <input className="input" inputMode="decimal" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
          </div>
        )}
      </div>
    </Modal>
  )
}
