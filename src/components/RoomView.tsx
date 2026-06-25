import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { statusColor } from './StatusBadge'
import { ScopeDetail } from './ScopeDetail'

// Each work scope is drawn as a card-like box positioned in the area, coloured by status,
// with its percent complete shown. Click one to view/edit its imported info.
export function RoomView() {
  const { floorId = '', areaId = '' } = useParams()
  const { building } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const floor = building.floors.find((f) => f.id === floorId)
  const area = floor?.areas.find((a) => a.id === areaId)
  const selected = area?.scopes.find((s) => s.id === selectedId) ?? null

  if (!area) return <div className="canvas"><div className="empty">Area not found.</div></div>

  return (
    <>
      <div className="canvas">
        <div className="plan">
          <svg viewBox="0 0 100 70" role="img" aria-label={area.name} preserveAspectRatio="xMidYMid meet">
            <rect x={1} y={1} width={98} height={68} fill="#0e1622" stroke="var(--border)" strokeWidth={0.4} rx={1} />
            {area.scopes.map((s) => {
              const cx = (s.x / 100) * 98 + 1
              const cy = (s.y / 100) * 68 + 1
              const isSel = s.id === selectedId
              const col = statusColor[s.status]
              const bw = 26, bh = 15
              return (
                <g key={s.id} className="equip" onClick={() => setSelectedId(s.id)} role="button" aria-label={s.name}>
                  <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={1.5}
                    fill="var(--panel-2)" stroke={isSel ? '#fff' : col} strokeWidth={isSel ? 1 : 0.6} />
                  <text x={cx} y={cy - 3} textAnchor="middle" fill="var(--text)" style={{ fontSize: 2.8, fontWeight: 600 }}>{s.name}</text>
                  <text x={cx} y={cy + 1} textAnchor="middle" fill={col} style={{ fontSize: 3.4, fontWeight: 700 }}>{s.progress}%</text>
                  {/* mini progress bar */}
                  <rect x={cx - bw / 2 + 2} y={cy + 3} width={bw - 4} height={1.4} rx={0.7} fill="#0e1622" />
                  <rect x={cx - bw / 2 + 2} y={cy + 3} width={((bw - 4) * s.progress) / 100} height={1.4} rx={0.7} fill={col} />
                  {(s.openPunch ?? 0) > 0 && (
                    <text x={cx} y={cy + bh / 2 - 1} textAnchor="middle" fill="var(--muted)" style={{ fontSize: 2 }}>{s.openPunch} punch</text>
                  )}
                </g>
              )
            })}
          </svg>
          <div className="hint">Click a scope to view and edit its turnover info</div>
        </div>
      </div>
      {selected && <ScopeDetail scope={selected} onClose={() => setSelectedId(null)} />}
    </>
  )
}
