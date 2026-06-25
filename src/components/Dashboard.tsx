import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, floorProgress, floorStatus } from '../data/store'
import {
  buildingProgress, buildingPunch, statusCounts, disciplineBreakdown, totalScopes,
} from '../data/rollup'
import { statusColor, statusLabel } from './StatusBadge'
import { api, paths } from '../api'
import type { ProgressStatus, ScopeType } from '../data/types'

const STATUS_ORDER: ProgressStatus[] = ['turned-over', 'commissioning', 'in-progress', 'not-started', 'on-hold']
const DISCIPLINE_LABEL: Record<ScopeType, string> = {
  hvac: 'HVAC', electrical: 'Electrical', plumbing: 'Plumbing', fire: 'Fire & Life Safety',
  finishes: 'Finishes', structure: 'Structure', 'it-data': 'IT / Data', fitout: 'Fit-out',
}

function Kpi({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-value" style={{ color }}>{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

// Simple SVG line chart of % complete over time.
function SCurve({ data }: { data: { day: string; pct: number }[] }) {
  if (data.length < 2) {
    return <div className="empty" style={{ padding: 30 }}>Not enough history yet — progress is recorded each day you make changes. Check back tomorrow to see the curve build.</div>
  }
  const W = 720, H = 220, pad = 30
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (W - 2 * pad))
  const ys = data.map((d) => H - pad - (d.pct / 100) * (H - 2 * pad))
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${H - pad} L${xs[0].toFixed(1)},${H - pad} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} preserveAspectRatio="xMidYMid meet">
      {[0, 25, 50, 75, 100].map((g) => {
        const y = H - pad - (g / 100) * (H - 2 * pad)
        return <g key={g}>
          <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="var(--border)" strokeWidth={0.5} />
          <text x={pad - 6} y={y + 3} textAnchor="end" fill="var(--muted)" style={{ fontSize: 10 }}>{g}</text>
        </g>
      })}
      <path d={area} fill="rgba(61,169,252,0.12)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={2.5} fill="var(--accent)" />)}
      <text x={pad} y={H - 8} fill="var(--muted)" style={{ fontSize: 10 }}>{data[0].day}</text>
      <text x={W - pad} y={H - 8} textAnchor="end" fill="var(--muted)" style={{ fontSize: 10 }}>{data[data.length - 1].day}</text>
    </svg>
  )
}

export function Dashboard() {
  const { project, building } = useStore()
  const navigate = useNavigate()
  const [history, setHistory] = useState<{ day: string; pct: number }[]>([])

  useEffect(() => {
    api.getHistory(project.id).then((r) => setHistory(r.history)).catch(() => {})
  }, [project.id])

  const pct = buildingProgress(building)
  const counts = useMemo(() => statusCounts(building), [building])
  const disciplines = useMemo(() => disciplineBreakdown(building), [building])
  const total = totalScopes(building)
  const turnedOver = counts['turned-over']
  const onHold = counts['on-hold']
  const punch = buildingPunch(building)
  const floors = useMemo(() => [...building.floors].sort((a, b) => b.level - a.level), [building])

  return (
    <div className="dashboard">
      <div className="dash-head">
        <h1>{building.name}</h1>
        <span className="sub">{building.address}</span>
      </div>

      <div className="kpi-row">
        <Kpi label="Complete" value={`${pct}%`} color="var(--accent)" sub={`${total} scopes`} />
        <Kpi label="Turned Over" value={turnedOver} color="var(--ok)" sub={`of ${total}`} />
        <Kpi label="Open Punch" value={punch} color={punch ? 'var(--warning)' : 'var(--muted)'} />
        <Kpi label="On Hold" value={onHold} color={onHold ? 'var(--alarm)' : 'var(--muted)'} />
        <Kpi label="Floors" value={building.floors.length} />
      </div>

      <div className="dash-grid">
        <section className="card">
          <h3>Status breakdown</h3>
          <div className="stacked">
            {STATUS_ORDER.map((s) => counts[s] > 0 && (
              <div key={s} style={{ width: `${(counts[s] / total) * 100}%`, background: statusColor[s] }} title={`${statusLabel(s)}: ${counts[s]}`} />
            ))}
          </div>
          <div className="legend" style={{ marginTop: 12, flexWrap: 'wrap', gap: 12 }}>
            {STATUS_ORDER.map((s) => (
              <span key={s}><span className="dot" style={{ background: statusColor[s] }} />{statusLabel(s)} · {counts[s]}</span>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>Progress over time</h3>
          <SCurve data={history} />
        </section>

        <section className="card">
          <h3>By floor</h3>
          {floors.map((f) => {
            const fp = floorProgress(f)
            const st = floorStatus(f)
            return (
              <div key={f.id} className="row-bar" onClick={() => navigate(paths.floor(project.id, f.id))}>
                <span className="row-bar-label">{f.name}</span>
                <div className="bar"><span style={{ width: `${fp}%`, background: statusColor[st] }} /></div>
                <span className="row-bar-pct">{fp}%</span>
              </div>
            )
          })}
        </section>

        <section className="card">
          <h3>By discipline</h3>
          {disciplines.map((d) => (
            <div key={d.type} className="row-bar">
              <span className="row-bar-label">{DISCIPLINE_LABEL[d.type]} <span className="sub">({d.count})</span></span>
              <div className="bar"><span style={{ width: `${d.pct}%`, background: 'var(--accent)' }} /></div>
              <span className="row-bar-pct">{d.pct}%</span>
            </div>
          ))}
          {disciplines.length === 0 && <div className="empty">No scopes yet.</div>}
        </section>
      </div>
    </div>
  )
}
