import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, areaStatus, areaProgress, areaPunch } from '../data/store'
import { statusColor } from './StatusBadge'
import { api, paths } from '../api'
import type { Area } from '../data/types'

const newId = () => 'ar-' + crypto.randomUUID().slice(0, 8)

interface Rect { x: number; y: number; w: number; h: number }

export function FloorView() {
  const { floorId = '' } = useParams()
  const { project, building, canEdit, updateFloor } = useStore()
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Rect | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  const floor = building.floors.find((f) => f.id === floorId)
  if (!floor) return <div className="canvas"><div className="empty">Floor not found.</div></div>

  const setAreas = (areas: Area[]) => updateFloor(floor.id, { areas })

  // Convert a mouse event to viewBox (0–100) coordinates, robust to letterboxing.
  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: Math.max(0, Math.min(100, p.x)), y: Math.max(0, Math.min(100, p.y)) }
  }

  const onDown = (e: React.PointerEvent) => {
    if (!editing) return
    const { x, y } = toSvg(e)
    dragStart.current = { x, y }
    setDraft({ x, y, w: 0, h: 0 })
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!editing || !dragStart.current) return
    const { x, y } = toSvg(e)
    const s = dragStart.current
    setDraft({ x: Math.min(s.x, x), y: Math.min(s.y, y), w: Math.abs(x - s.x), h: Math.abs(y - s.y) })
  }
  const onUp = () => {
    if (!editing || !draft) return
    dragStart.current = null
    if (draft.w > 3 && draft.h > 3) {
      const name = prompt('Name this area:', `Area ${floor.areas.length + 1}`)
      if (name) {
        const r = { x: +draft.x.toFixed(1), y: +draft.y.toFixed(1), w: +draft.w.toFixed(1), h: +draft.h.toFixed(1) }
        setAreas([...floor.areas, { id: newId(), name, ...r, scopes: [] }])
      }
    }
    setDraft(null)
  }

  const uploadPlan = async (file: File) => {
    try {
      const url = await api.uploadImage(file)
      updateFloor(floor.id, { planImage: url })
    } catch (e) {
      alert(`Upload failed: ${(e as Error).message}`)
    }
  }

  const renameArea = (a: Area) => {
    const name = prompt('Rename area:', a.name)
    if (name) setAreas(floor.areas.map((x) => (x.id === a.id ? { ...x, name } : x)))
  }
  const deleteArea = (a: Area) => {
    if (confirm(`Delete area "${a.name}" and its ${a.scopes.length} scopes?`)) setAreas(floor.areas.filter((x) => x.id !== a.id))
  }

  return (
    <div className="canvas">
      <div className="plan">
        {canEdit && (
          <div className="toolbar">
            <button className={`btn ${editing ? '' : 'secondary'}`} onClick={() => { setEditing((v) => !v); setDraft(null) }}>
              {editing ? 'Done editing' : 'Edit areas'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPlan(f); e.target.value = '' }} />
            <button className="btn secondary" onClick={() => fileRef.current?.click()}>
              {floor.planImage ? 'Replace plan' : 'Upload floor plan'}
            </button>
            {floor.planImage && (
              <button className="btn secondary" onClick={() => updateFloor(floor.id, { planImage: undefined })}>Remove plan</button>
            )}
            {editing && <span className="sub">Drag on the plan to trace a new area</span>}
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          role="img"
          aria-label={floor.name}
          preserveAspectRatio="xMidYMid meet"
          style={{ touchAction: 'none', cursor: editing ? 'crosshair' : 'default' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        >
          {floor.planImage ? (
            <image href={floor.planImage} x={0} y={0} width={100} height={100} preserveAspectRatio="none" opacity={0.85} />
          ) : (
            <rect x={1} y={1} width={98} height={98} fill="#0e1622" stroke="var(--border)" strokeWidth={0.4} />
          )}

          {floor.areas.map((a) => {
            const st = areaStatus(a)
            const pct = areaProgress(a)
            const punch = areaPunch(a)
            return (
              <g key={a.id} className={editing ? '' : 'zone'} style={{ cursor: editing ? 'default' : 'pointer' }}
                onClick={() => { if (!editing) navigate(paths.area(project.id, floor.id, a.id)) }}
                role="button" aria-label={a.name}>
                <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={1}
                  fill={floor.planImage ? 'rgba(20,26,36,0.55)' : 'var(--panel-2)'}
                  stroke={statusColor[st]} strokeWidth={0.6} />
                <text className="zone-label" x={a.x + 2} y={a.y + 5} style={{ fontSize: 3 }}>{a.name}</text>
                <text className="zone-sub" x={a.x + 2} y={a.y + 8.6} style={{ fontSize: 2.3 }}>
                  {a.scopes.length} scopes{punch > 0 ? ` · ${punch} punch` : ''}
                </text>
                {a.scopes.length > 0 && <>
                  <rect x={a.x + 2} y={a.y + a.h - 4} width={a.w - 4} height={1.6} rx={0.8} fill="#0e1622" stroke="var(--border)" strokeWidth={0.2} />
                  <rect x={a.x + 2} y={a.y + a.h - 4} width={((a.w - 4) * pct) / 100} height={1.6} rx={0.8} fill={statusColor[st]} />
                  <text x={a.x + a.w - 2} y={a.y + 5} textAnchor="end" fill={statusColor[st]} style={{ fontSize: 3.4, fontWeight: 700 }}>{pct}%</text>
                </>}
                {editing && <>
                  <text x={a.x + a.w - 2} y={a.y + a.h - 1.5} textAnchor="end" style={{ fontSize: 3, cursor: 'pointer' }} fill="var(--accent)"
                    onClick={(e) => { e.stopPropagation(); renameArea(a) }}>rename</text>
                  <text x={a.x + a.w - 12} y={a.y + a.h - 1.5} textAnchor="end" style={{ fontSize: 3, cursor: 'pointer' }} fill="var(--alarm)"
                    onClick={(e) => { e.stopPropagation(); deleteArea(a) }}>delete</text>
                </>}
              </g>
            )
          })}

          {draft && <rect x={draft.x} y={draft.y} width={draft.w} height={draft.h} fill="rgba(61,169,252,0.2)" stroke="var(--accent)" strokeWidth={0.5} strokeDasharray="1.5 1" />}
        </svg>

        <div className="hint">
          {floor.areas.length === 0
            ? canEdit ? 'No areas yet — click “Edit areas”, upload a floor plan, and drag to trace rooms.' : 'No areas on this floor yet.'
            : editing ? 'Drag to add an area · use rename/delete on each area' : 'Click an area to see its work scopes'}
        </div>
      </div>
    </div>
  )
}
