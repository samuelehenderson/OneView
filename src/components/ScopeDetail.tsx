import { useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useAuth } from '../auth'
import { api } from '../api'
import { StatusBadge, statusColor, statusLabel } from './StatusBadge'
import type { Attachment, Comment, ProgressStatus, PunchItem, Scope } from '../data/types'

const STATUSES: ProgressStatus[] = ['not-started', 'in-progress', 'commissioning', 'turned-over', 'on-hold']
const uid = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div className="meta-row">
      <span className="label">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function PunchList({ items, onChange }: { items: PunchItem[]; onChange: (items: PunchItem[]) => void }) {
  const [text, setText] = useState('')
  const add = () => {
    if (!text.trim()) return
    onChange([...items, { id: uid('pn'), text: text.trim(), done: false, createdAt: new Date().toISOString() }])
    setText('')
  }
  const open = items.filter((i) => !i.done).length
  return (
    <>
      {items.map((i) => (
        <div key={i.id} className="punch-row">
          <input type="checkbox" checked={i.done} onChange={() => onChange(items.map((x) => x.id === i.id ? { ...x, done: !x.done } : x))} />
          <span className={i.done ? 'punch-done' : ''}>{i.text}</span>
          <button className="link-btn" onClick={() => onChange(items.filter((x) => x.id !== i.id))}>✕</button>
        </div>
      ))}
      <div className="add-row">
        <input placeholder="Add punch item…" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn secondary" onClick={add}>Add</button>
      </div>
      <div className="sub" style={{ marginTop: 4 }}>{open} open · {items.length - open} closed</div>
    </>
  )
}

function Attachments({ items, onChange }: { items: Attachment[]; onChange: (items: Attachment[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const upload = async (file: File) => {
    setBusy(true)
    try {
      const url = await api.uploadImage(file)
      onChange([...items, { id: uid('at'), url, name: file.name, kind: 'image' }])
    } catch (e) { alert(`Upload failed: ${(e as Error).message}`) } finally { setBusy(false) }
  }
  return (
    <>
      <div className="thumbs">
        {items.map((a) => (
          <div key={a.id} className="thumb">
            <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name} /></a>
            <button className="thumb-del" title="Remove" onClick={() => onChange(items.filter((x) => x.id !== a.id))}>✕</button>
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
      <button className="btn secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? 'Uploading…' : '+ Add photo'}
      </button>
    </>
  )
}

function Comments({ items, author, onChange }: { items: Comment[]; author: string; onChange: (items: Comment[]) => void }) {
  const [text, setText] = useState('')
  const post = () => {
    if (!text.trim()) return
    onChange([...items, { id: uid('cm'), text: text.trim(), author, at: new Date().toISOString() }])
    setText('')
  }
  return (
    <>
      {items.map((c) => (
        <div key={c.id} className="comment">
          <div className="comment-head"><strong>{c.author}</strong><span className="sub">{new Date(c.at).toLocaleString()}</span></div>
          <div>{c.text}</div>
        </div>
      ))}
      <div className="add-row" style={{ marginTop: 8 }}>
        <input placeholder="Add a comment…" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && post()} />
        <button className="btn secondary" onClick={post}>Post</button>
      </div>
    </>
  )
}

export function ScopeDetail({ scope, onClose }: { scope: Scope; onClose: () => void }) {
  const { updateScope, canEdit } = useStore()
  const { user } = useAuth()
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
          <div style={{ flex: 1 }}><div className="bar"><span style={{ width: `${scope.progress}%`, background: col }} /></div></div>
        </div>
        <input type="range" min={0} max={100} value={scope.progress} style={{ width: '100%' }}
          onChange={(e) => set({ progress: Number(e.target.value) })} />

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

        <h3>Punch List</h3>
        <PunchList items={scope.punchList ?? []} onChange={(punchList) => set({ punchList })} />

        <h3>Photos</h3>
        <Attachments items={scope.attachments ?? []} onChange={(attachments) => set({ attachments })} />

        <h3>Notes</h3>
        <textarea placeholder="Progress notes, blockers, RFIs…" value={scope.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />

        <h3>Comments</h3>
        <Comments items={scope.comments ?? []} author={user?.name || 'Unknown'} onChange={(comments) => set({ comments })} />
      </fieldset>
    </aside>
  )
}
