import { useNavigate } from 'react-router-dom'
import { useStore, floorStatus, floorProgress, floorPunch, buildingProgress } from '../data/store'
import { statusColor } from './StatusBadge'
import { paths } from '../api'

// The top-level building exterior: floors stacked vertically, each clickable.
export function BuildingView() {
  const { project, building, canEdit, replaceBuilding } = useStore()
  const navigate = useNavigate()

  const W = 520
  const floorH = 72
  const gap = 6
  const padTop = 40
  // Sort top floor first (highest level at the top of the graphic).
  const floors = [...building.floors].sort((a, b) => b.level - a.level)
  const H = padTop + floors.length * (floorH + gap) + 16

  // Move a floor up/down by swapping its level with the neighbour's (forcing a gap on ties).
  const moveFloor = (id: string, dir: 'up' | 'down') => {
    const i = floors.findIndex((f) => f.id === id)
    const j = dir === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= floors.length) return
    const a = floors[i]
    const b = floors[j]
    const levels: Record<string, number> = {}
    if (a.level === b.level) levels[a.id] = dir === 'up' ? b.level + 1 : b.level - 1
    else { levels[a.id] = b.level; levels[b.id] = a.level }
    replaceBuilding({
      ...building,
      floors: building.floors.map((f) => (f.id in levels ? { ...f, level: levels[f.id] } : f)),
    })
  }

  return (
    <div className="canvas">
      <div className="plan">
        {canEdit && <div className="toolbar"><span className="sub">Use the ▲▼ arrows on each floor to reorder the stack</span></div>}
        <svg viewBox={`0 0 ${W + 80} ${H}`} role="img" aria-label="Building" preserveAspectRatio="xMidYMid meet">
          {/* Roof */}
          <polygon
            points={`40,${padTop} ${40 + W},${padTop} ${40 + W - 30},${padTop - 22} ${70},${padTop - 22}`}
            fill="#222c39"
            stroke="var(--border)"
          />
          {floors.map((f, i) => {
            const y = padTop + i * (floorH + gap)
            const st = floorStatus(f)
            const pct = floorProgress(f)
            const punch = floorPunch(f)
            return (
              <g key={f.id} className="zone" onClick={() => navigate(paths.floor(project.id, f.id))} role="button" aria-label={f.name}>
                <rect x={40} y={y} width={W} height={floorH} rx={4} fill="var(--panel-2)" stroke="var(--border)" />
                <rect x={40} y={y} width={8} height={floorH} rx={4} fill={statusColor[st]} />
                <text className="zone-label" x={56} y={y + 24}>{f.name}</text>
                <text className="zone-sub" x={56} y={y + 40}>
                  Level {f.level} · {f.areas.length} areas{punch > 0 ? ` · ${punch} open punch` : ''}
                </text>
                {/* progress bar */}
                <rect x={56} y={y + 50} width={W - 120} height={8} rx={4} fill="#0e1622" stroke="var(--border)" strokeWidth={0.5} />
                <rect x={56} y={y + 50} width={((W - 120) * pct) / 100} height={8} rx={4} fill={statusColor[st]} />
                {/* big percent */}
                <text x={40 + W - 18} y={y + 34} textAnchor="end" fill={statusColor[st]} style={{ fontSize: 22, fontWeight: 700 }}>
                  {pct}%
                </text>
                <circle cx={40 + W - 22} cy={y + 50} r={5} fill={statusColor[st]} />
                {/* reorder arrows (edit access only) */}
                {canEdit && (
                  <g style={{ cursor: 'pointer' }} onClick={(e) => e.stopPropagation()}>
                    {i > 0 && (
                      <text x={22} y={y + 30} textAnchor="middle" fill="var(--accent)" style={{ fontSize: 22 }}
                        onClick={(e) => { e.stopPropagation(); moveFloor(f.id, 'up') }}>▲</text>
                    )}
                    {i < floors.length - 1 && (
                      <text x={22} y={y + 56} textAnchor="middle" fill="var(--accent)" style={{ fontSize: 22 }}
                        onClick={(e) => { e.stopPropagation(); moveFloor(f.id, 'down') }}>▼</text>
                    )}
                  </g>
                )}
              </g>
            )
          })}
          {/* Ground line */}
          <rect x={20} y={padTop + floors.length * (floorH + gap)} width={W + 40} height={6} fill="var(--border)" />
        </svg>
        <div className="hint">
          Building {buildingProgress(building)}% complete · Click a floor to open its plan
        </div>
      </div>
    </div>
  )
}
