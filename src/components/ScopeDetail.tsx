import { useStore } from '../data/store'
import { StatusBadge, statusColor, statusLabel } from './StatusBadge'
import type { ProgressStatus, Scope } from '../data/types'

const STATUSES: ProgressStatus[] = ['not-started', 'in-progress', 'commissioning', 'turned-over', 'on-hold']

function Field({ label, value, onChange, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="meta-row">
      <span className="label">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function ScopeDetail({ scope, onClose }: { scope: Scope; onClose: () => void }) {
  const { updateScope, canEdit } = useStore()
  const set = (patch: Partial<Scope>) => updateScope(scope.id, patch)
  const col = statusColor[scope.status]

  return (
    <aside className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="type">{scope.type.replace('-', ' ')}</div>
          <h2>{scope.name}</h2>
        </div>
        <button className="btn secondary" onClick={onClose}>✕</button>
      </div>
      <div style={{ marginTop: 6 }}><StatusBadge status={scope.status} /></div>

      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <h3>Progress</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span className="progress-big" style={{ color: col }}>{scope.progress}%</span>
        <div style={{ flex: 1 }}>
          <div className="bar"><span style={{ width: `${scope.progress}%`, background: col }} /></div>
        </div>
      </div>
      <input
        type="range" min={0} max={100} value={scope.progress} style={{ width: '100%' }}
        onChange={(e) => set({ progress: Number(e.target.value) })}
      />

      <h3>Status</h3>
      <select value={scope.status} onChange={(e) => set({ status: e.target.value as ProgressStatus })} style={{ width: '100%' }}>
        {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
      </select>

      <h3>Turnover Info</h3>
      <Field label="Contractor" value={scope.contractor ?? ''} onChange={(v) => set({ contractor: v })} />
      <Field label="Responsible" value={scope.responsible ?? ''} onChange={(v) => set({ responsible: v })} />
      <Field label="Start" type="date" value={scope.startDate ?? ''} onChange={(v) => set({ startDate: v })} />
      <Field label="Target" type="date" value={scope.targetDate ?? ''} onChange={(v) => set({ targetDate: v })} />
      <Field label="Turned Over" type="date" value={scope.turnoverDate ?? ''} onChange={(v) => set({ turnoverDate: v })} />
      <div className="meta-row">
        <span className="label">Open Punch Items</span>
        <input type="number" min={0} value={scope.openPunch ?? 0} onChange={(e) => set({ openPunch: Number(e.target.value) })} />
      </div>

      <h3>Notes</h3>
      <textarea
        placeholder="Progress notes, blockers, RFIs…"
        value={scope.notes ?? ''}
        onChange={(e) => set({ notes: e.target.value })}
      />
      </fieldset>
    </aside>
  )
}
