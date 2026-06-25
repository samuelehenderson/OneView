import { NavLink } from 'react-router-dom'
import { paths } from '../api'

// Tabs across the top of a project: Overview / Building / Schedule.
export function ProjectNav({ projectId }: { projectId: string }) {
  const tabs = [
    { to: paths.project(projectId), label: 'Overview', end: true },
    { to: paths.building(projectId), label: 'Building', end: false },
    { to: paths.schedule(projectId), label: 'Schedule', end: false },
    { to: paths.timeline(projectId), label: 'Timeline', end: false },
  ]
  return (
    <nav className="projectnav">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
