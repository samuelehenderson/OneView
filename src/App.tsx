import { useMemo, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BuildingView } from './components/BuildingView'
import { FloorView } from './components/FloorView'
import { RoomView } from './components/RoomView'
import { Breadcrumbs, type Crumb } from './components/Breadcrumbs'
import { DataMenu } from './components/DataMenu'
import { AuthPage } from './components/AuthPage'
import { ProjectList } from './components/ProjectList'
import { ProjectProvider, useStore, buildingProgress } from './data/store'
import { statusColor, statusLabel } from './components/StatusBadge'
import { useAuth } from './auth'
import { paths } from './api'
import type { ProgressStatus } from './data/types'

const LEGEND: ProgressStatus[] = ['not-started', 'in-progress', 'commissioning', 'turned-over', 'on-hold']

function RouteBreadcrumbs() {
  const { project, building } = useStore()
  const { pathname } = useLocation()
  const m = pathname.match(/\/floor\/([^/]+)(?:\/area\/([^/]+))?/)
  const floorId = m?.[1]
  const areaId = m?.[2]
  const crumbs: Crumb[] = [{ label: 'Projects', to: '/' }, { label: building.name, to: paths.project(project.id) }]
  const floor = building.floors.find((f) => f.id === floorId)
  if (floor) crumbs.push({ label: floor.name, to: paths.floor(project.id, floor.id) })
  const area = floor?.areas.find((a) => a.id === areaId)
  if (area) crumbs.push({ label: area.name })
  return <Breadcrumbs crumbs={crumbs} />
}

function SaveIndicator() {
  const { saveState, canEdit } = useStore()
  if (!canEdit) return <span className="sub">View only</span>
  const text = { idle: '', saving: 'Saving…', saved: 'All changes saved', error: 'Save failed' }[saveState]
  if (!text) return null
  return <span className="sub" style={{ color: saveState === 'error' ? 'var(--alarm)' : 'var(--muted)' }}>{text}</span>
}

function Search() {
  const { project, building } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const matches = useMemo(() => {
    if (!q.trim()) return []
    const needle = q.toLowerCase()
    const out: { label: string; to: string }[] = []
    for (const f of building.floors)
      for (const a of f.areas)
        if (a.name.toLowerCase().includes(needle) || f.name.toLowerCase().includes(needle))
          out.push({ label: `${a.name} — ${f.name}`, to: paths.area(project.id, f.id, a.id) })
    return out.slice(0, 6)
  }, [q, building, project.id])

  return (
    <div className="search" style={{ position: 'relative' }}>
      <input placeholder="Search areas…" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <div style={{ position: 'absolute', top: 36, right: 0, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, width: 280, zIndex: 10, overflow: 'hidden' }}>
          {matches.map((m) => (
            <div key={m.to} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
              onClick={() => { navigate(m.to); setQ('') }} onMouseDown={(e) => e.preventDefault()}>
              {m.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { building } = useStore()
  const { logout } = useAuth()
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="logo">One<span>View</span></span>
        </Link>
        <span className="sub">{building.name}</span>
        <span className="sub" style={{ color: 'var(--accent)', fontWeight: 700 }}>{buildingProgress(building)}% complete</span>
        <SaveIndicator />
        <span className="spacer" />
        <div className="legend">
          {LEGEND.map((s) => (
            <span key={s}><span className="dot" style={{ background: statusColor[s] }} />{statusLabel(s)}</span>
          ))}
        </div>
        <DataMenu />
        <Search />
        <button className="btn secondary" onClick={logout}>Sign out</button>
      </header>
      <RouteBreadcrumbs />
      <div className="stage">{children}</div>
    </div>
  )
}

// Wraps the project-scoped views: reads :projectId, provides the store + layout.
function ProjectShell({ view }: { view: React.ReactNode }) {
  const { projectId = '' } = useParams()
  return (
    <ProjectProvider projectId={projectId}>
      <ProjectLayout>{view}</ProjectLayout>
    </ProjectProvider>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>
  if (!user) return <AuthPage />

  return (
    <Routes>
      <Route path="/" element={<ProjectList />} />
      <Route path="/p/:projectId" element={<ProjectShell view={<BuildingView />} />} />
      <Route path="/p/:projectId/floor/:floorId" element={<ProjectShell view={<FloorView />} />} />
      <Route path="/p/:projectId/floor/:floorId/area/:areaId" element={<ProjectShell view={<RoomView />} />} />
    </Routes>
  )
}
