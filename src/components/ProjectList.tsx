import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, paths, type Project } from '../api'
import { buildingProgress } from '../data/rollup'
import { useAuth } from '../auth'

export function ProjectList() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  const refresh = () => api.listProjects().then(({ projects }) => setProjects(projects)).catch((e) => setError((e as Error).message))
  useEffect(() => { refresh() }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const { project } = await api.createProject(name.trim(), address.trim())
      navigate(paths.project(project.id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const del = async (p: Project) => {
    if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return
    await api.deleteProject(p.id)
    refresh()
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">One<span>View</span></span>
        <span className="spacer" />
        <span className="sub">{user?.name} ({user?.email})</span>
        <button className="btn secondary" onClick={logout}>Sign out</button>
      </header>

      <div className="projects">
        <div className="projects-head">
          <h1>Projects</h1>
          <button className="btn" onClick={() => setCreating((v) => !v)}>{creating ? 'Cancel' : '+ New project'}</button>
        </div>

        {creating && (
          <form className="new-project" onSubmit={create}>
            <input autoFocus placeholder="Project name (e.g. Aurora Tower)" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Address / description (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
            <button className="btn" type="submit">Create</button>
          </form>
        )}

        {error && <div className="auth-error">{error}</div>}
        {projects === null && !error && <div className="empty">Loading…</div>}
        {projects?.length === 0 && <div className="empty">No projects yet. Create your first one above.</div>}

        <div className="project-grid">
          {projects?.map((p) => {
            const pct = buildingProgress(p.building)
            return (
              <div key={p.id} className="project-card" onClick={() => navigate(paths.project(p.id))}>
                <div className="project-card-top">
                  <h3>{p.name}</h3>
                  {p.myRole === 'viewer' && <span className="pill offline">View only</span>}
                </div>
                <div className="sub">{p.address || '—'}</div>
                <div className="bar" style={{ marginTop: 12 }}><span style={{ width: `${pct}%`, background: 'var(--accent)' }} /></div>
                <div className="project-card-foot">
                  <span>{pct}% complete</span>
                  <span className="sub">{p.building.floors.length} floors</span>
                </div>
                {p.myRole === 'owner' && (
                  <button className="card-del" title="Delete" onClick={(e) => { e.stopPropagation(); del(p) }}>✕</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
