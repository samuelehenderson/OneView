import { useState } from 'react'
import { api, type Member, type Project } from '../api'

// Manage collaborators on a project. Owner can add/remove; others see the list.
export function Share({ project }: { project: Project }) {
  const isOwner = project.myRole === 'owner'
  const [members, setMembers] = useState<Member[]>(project.memberList ?? [])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const flash = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000) }

  const add = async () => {
    if (!email.trim()) return
    setBusy(true)
    try {
      const { project: p } = await api.addMember(project.id, email.trim(), role)
      setMembers(p.memberList ?? [])
      setEmail('')
      flash('Added', true)
    } catch (e) { flash((e as Error).message, false) } finally { setBusy(false) }
  }
  const remove = async (m: Member) => {
    try {
      const { project: p } = await api.removeMember(project.id, m.id)
      setMembers(p.memberList ?? [])
    } catch (e) { flash((e as Error).message, false) }
  }

  return (
    <section className="card">
      <h3>Team &amp; sharing</h3>
      <div className="member-row">
        <span>{project.ownerName || project.ownerEmail || 'Owner'}</span>
        <span className="pill info">Owner</span>
      </div>
      {members.map((m) => (
        <div key={m.id} className="member-row">
          <span>{m.name ? `${m.name} · ${m.email}` : m.email}</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="pill offline">{m.role}</span>
            {isOwner && <button className="link-btn" onClick={() => remove(m)}>remove</button>}
          </span>
        </div>
      ))}
      {members.length === 0 && <div className="sub" style={{ padding: '6px 0' }}>No collaborators yet.</div>}

      {isOwner && (
        <>
          <div className="add-row" style={{ marginTop: 12 }}>
            <input placeholder="teammate@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()} />
            <select value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="btn" disabled={busy} onClick={add}>Invite</button>
          </div>
          <div className="sub" style={{ marginTop: 6 }}>They must have registered an account with that email first.</div>
        </>
      )}
      {msg && <div className="sub" style={{ marginTop: 6, color: msg.ok ? 'var(--ok)' : 'var(--alarm)' }}>{msg.text}</div>}
    </section>
  )
}
