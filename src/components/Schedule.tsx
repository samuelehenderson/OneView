import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, scopeOpenPunch } from '../data/store'
import { flattenScopes, type FlatScope } from '../data/rollup'
import { StatusBadge, statusColor } from './StatusBadge'
import { paths } from '../api'
import type { ProgressStatus } from '../data/types'

type SortKey = 'floor' | 'area' | 'scope' | 'discipline' | 'status' | 'progress' | 'target' | 'punch'

const STATUS_OPTS: ('all' | ProgressStatus)[] = ['all', 'not-started', 'in-progress', 'commissioning', 'turned-over', 'on-hold']

export function Schedule() {
  const { project, building } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | ProgressStatus>('all')
  const [discipline, setDiscipline] = useState<string>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'floor', dir: 1 })

  const all = useMemo(() => flattenScopes(building), [building])
  const disciplines = useMemo(() => [...new Set(all.map((r) => r.scope.type))].sort(), [all])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let r = all.filter((f) => {
      if (status !== 'all' && f.scope.status !== status) return false
      if (discipline !== 'all' && f.scope.type !== discipline) return false
      if (needle && ![f.scope.name, f.areaName, f.floorName, f.scope.contractor].some((v) => v?.toLowerCase().includes(needle))) return false
      return true
    })
    const val = (f: FlatScope): string | number => ({
      floor: -f.level, area: f.areaName, scope: f.scope.name, discipline: f.scope.type,
      status: f.scope.status, progress: f.scope.progress, target: f.scope.targetDate ?? '', punch: scopeOpenPunch(f.scope),
    } as Record<SortKey, string | number>)[sort.key]
    return [...r].sort((a, b) => {
      const va = val(a), vb = val(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir
    })
  }, [all, q, status, discipline, sort])

  const head = (key: SortKey, label: string) => (
    <th onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
      {label}{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  )

  const exportCsv = () => {
    const header = ['Floor', 'Area', 'Scope', 'Discipline', 'Status', 'Progress', 'Contractor', 'Target', 'OpenPunch']
    const lines = [header.join(',')]
    for (const f of rows)
      lines.push([f.floorName, f.areaName, f.scope.name, f.scope.type, f.scope.status, f.scope.progress, f.scope.contractor ?? '', f.scope.targetDate ?? '', scopeOpenPunch(f.scope)]
        .map((v) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(','))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${building.name}-schedule.csv`; a.click()
  }

  return (
    <div className="schedule">
      <div className="schedule-bar">
        <input placeholder="Search scope, area, floor, contractor…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | ProgressStatus)}>
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
        <select value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
          <option value="all">All disciplines</option>
          {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="spacer" />
        <span className="sub">{rows.length} of {all.length} scopes</span>
        <button className="btn secondary" onClick={exportCsv}>Export view</button>
      </div>

      <div className="table-wrap">
        <table className="scope-table">
          <thead>
            <tr>
              {head('floor', 'Floor')}{head('area', 'Area')}{head('scope', 'Scope')}{head('discipline', 'Discipline')}
              {head('status', 'Status')}{head('progress', 'Progress')}{head('target', 'Target')}{head('punch', 'Punch')}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.scope.id} onClick={() => navigate(paths.area(project.id, f.floorId, f.areaId, f.scope.id))}>
                <td>{f.floorName}</td>
                <td>{f.areaName}</td>
                <td>{f.scope.name}</td>
                <td className="sub">{f.scope.type}</td>
                <td><StatusBadge status={f.scope.status} /></td>
                <td>
                  <div className="mini-bar"><span style={{ width: `${f.scope.progress}%`, background: statusColor[f.scope.status] }} /></div>
                  <span className="sub">{f.scope.progress}%</span>
                </td>
                <td className="sub">{f.scope.targetDate || '—'}</td>
                <td>{scopeOpenPunch(f.scope) || ''}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="empty" style={{ padding: 30 }}>No scopes match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
