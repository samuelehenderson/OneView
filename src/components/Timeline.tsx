import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { flattenScopes, isOverdue } from '../data/rollup'
import { statusColor } from './StatusBadge'
import { paths } from '../api'

const DAY = 86400000

// A lightweight Gantt: each scope with start+target dates becomes a bar on a shared time axis.
export function Timeline() {
  const { project, building } = useStore()
  const navigate = useNavigate()

  const rows = useMemo(
    () => flattenScopes(building).filter((f) => f.scope.startDate && f.scope.targetDate),
    [building],
  )

  const { min, max, ticks } = useMemo(() => {
    if (rows.length === 0) return { min: 0, max: 1, ticks: [] as { frac: number; label: string }[] }
    let mn = Infinity, mx = -Infinity
    for (const f of rows) {
      mn = Math.min(mn, Date.parse(f.scope.startDate!))
      mx = Math.max(mx, Date.parse(f.scope.targetDate!))
    }
    if (mx <= mn) mx = mn + DAY
    // Monthly tick marks across the span.
    const ticks: { frac: number; label: string }[] = []
    const d = new Date(mn); d.setDate(1)
    while (d.getTime() <= mx) {
      const frac = (d.getTime() - mn) / (mx - mn)
      if (frac >= 0) ticks.push({ frac, label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) })
      d.setMonth(d.getMonth() + 1)
    }
    return { min: mn, max: mx, ticks }
  }, [rows])

  if (rows.length === 0)
    return <div className="empty" style={{ padding: 40 }}>No scopes with both a start and target date yet. Add dates in a scope’s detail panel (or import them) to see the timeline.</div>

  const todayFrac = (Date.now() - min) / (max - min)
  const frac = (t: number) => Math.max(0, Math.min(1, (t - min) / (max - min)))

  return (
    <div className="timeline">
      <div className="gantt-axis">
        {ticks.map((t, i) => <span key={i} className="gantt-tick" style={{ left: `${t.frac * 100}%` }}>{t.label}</span>)}
        {todayFrac >= 0 && todayFrac <= 1 && <span className="gantt-today" style={{ left: `${todayFrac * 100}%` }} title="Today" />}
      </div>
      <div className="gantt-rows">
        {rows.map((f) => {
          const s = Date.parse(f.scope.startDate!)
          const e = Date.parse(f.scope.targetDate!)
          const left = frac(s) * 100
          const width = Math.max(1.5, (frac(e) - frac(s)) * 100)
          const overdue = isOverdue(f.scope)
          return (
            <div key={f.scope.id} className="gantt-row" onClick={() => navigate(paths.area(project.id, f.floorId, f.areaId, f.scope.id))}>
              <div className="gantt-label" title={`${f.scope.name} — ${f.areaName}, ${f.floorName}`}>
                <span className="gantt-scope">{f.scope.name}</span>
                <span className="sub">{f.areaName} · {f.floorName}</span>
              </div>
              <div className="gantt-track">
                {todayFrac >= 0 && todayFrac <= 1 && <span className="gantt-today-line" style={{ left: `${todayFrac * 100}%` }} />}
                <div className="gantt-bar" style={{ left: `${left}%`, width: `${width}%`, background: statusColor[f.scope.status], outline: overdue ? '2px solid var(--alarm)' : 'none' }}>
                  <span className="gantt-fill" style={{ width: `${f.scope.progress}%` }} />
                  <span className="gantt-bar-pct">{f.scope.progress}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="hint" style={{ padding: '12px 20px' }}>Bars span start → target date · inner fill shows % complete · red outline = overdue · the line is today</div>
    </div>
  )
}
