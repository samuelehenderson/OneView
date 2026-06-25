import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import {
  buildingProgress, buildingPunch, overdueCount, statusCounts,
  floorProgress, floorStatus, areaPunch, flattenScopes, scopeOpenPunch, isOverdue,
} from '../data/rollup'
import { statusLabel } from './StatusBadge'
import { paths } from '../api'
import type { ProgressStatus } from '../data/types'

const STATUS_ORDER: ProgressStatus[] = ['turned-over', 'commissioning', 'in-progress', 'not-started', 'on-hold']

// A print-optimised turnover/progress report. Renders as a white "document" so it
// prints (or saves to PDF via the browser) cleanly regardless of the dark UI theme.
export function Report() {
  const { project, building } = useStore()
  const pct = buildingProgress(building)
  const counts = useMemo(() => statusCounts(building), [building])
  const floors = useMemo(() => [...building.floors].sort((a, b) => b.level - a.level), [building])
  const flat = useMemo(() => flattenScopes(building), [building])
  const generated = new Date().toLocaleString()

  return (
    <div className="report-page">
      <div className="report-toolbar no-print">
        <Link className="btn secondary" to={paths.project(project.id)}>← Back</Link>
        <button className="btn" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div className="report">
        <header className="report-head">
          <div>
            <h1>{building.name}</h1>
            <div className="muted">{building.address}</div>
          </div>
          <div className="report-meta">
            <div className="report-pct">{pct}%</div>
            <div className="muted">complete</div>
          </div>
        </header>
        <div className="muted report-gen">Progress &amp; turnover report · generated {generated}</div>

        <h2>Summary</h2>
        <table className="report-table">
          <tbody>
            <tr><th>Overall complete</th><td>{pct}%</td><th>Total scopes</th><td>{flat.length}</td></tr>
            <tr><th>Turned over</th><td>{counts['turned-over']}</td><th>Open punch items</th><td>{buildingPunch(building)}</td></tr>
            <tr><th>On hold</th><td>{counts['on-hold']}</td><th>Overdue</th><td>{overdueCount(building)}</td></tr>
          </tbody>
        </table>

        <h2>Status breakdown</h2>
        <table className="report-table">
          <thead><tr>{STATUS_ORDER.map((s) => <th key={s}>{statusLabel(s)}</th>)}</tr></thead>
          <tbody><tr>{STATUS_ORDER.map((s) => <td key={s}>{counts[s]}</td>)}</tr></tbody>
        </table>

        <h2>By floor</h2>
        <table className="report-table">
          <thead><tr><th>Floor</th><th>Level</th><th>Status</th><th>Complete</th><th>Areas</th><th>Open punch</th></tr></thead>
          <tbody>
            {floors.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td><td>{f.level}</td><td>{statusLabel(floorStatus(f))}</td>
                <td>{floorProgress(f)}%</td><td>{f.areas.length}</td>
                <td>{f.areas.reduce((n, a) => n + areaPunch(a), 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>All scopes</h2>
        <table className="report-table compact">
          <thead><tr>
            <th>Floor</th><th>Area</th><th>Scope</th><th>Discipline</th><th>Status</th>
            <th>%</th><th>Contractor</th><th>Target</th><th>Turned over</th><th>Punch</th>
          </tr></thead>
          <tbody>
            {flat.map((f) => (
              <tr key={f.scope.id}>
                <td>{f.floorName}</td><td>{f.areaName}</td><td>{f.scope.name}</td><td>{f.scope.type}</td>
                <td>{statusLabel(f.scope.status)}</td><td>{f.scope.progress}%</td>
                <td>{f.scope.contractor || ''}</td>
                <td style={isOverdue(f.scope) ? { color: '#c00', fontWeight: 700 } : undefined}>{f.scope.targetDate || ''}</td>
                <td>{f.scope.turnoverDate || ''}</td><td>{scopeOpenPunch(f.scope) || ''}</td>
              </tr>
            ))}
            {flat.length === 0 && <tr><td colSpan={10}>No scopes yet.</td></tr>}
          </tbody>
        </table>

        <footer className="report-foot muted">OneView · {building.name} · {generated}</footer>
      </div>
    </div>
  )
}
