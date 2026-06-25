import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { paths } from '../api'
import { buildingFromUpload, csvFromBuilding, TEMPLATE_CSV } from '../data/io'

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DataMenu() {
  const { project, building, canEdit, replaceBuilding } = useStore()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  const onFile = async (file: File) => {
    try {
      const next = await buildingFromUpload(file)
      // Preserve the project's own name/address; only the floors are imported.
      next.name = building.name
      next.address = building.address
      const scopes = next.floors.reduce((n, f) => n + f.areas.reduce((m, a) => m + a.scopes.length, 0), 0)
      replaceBuilding(next)
      navigate(paths.project(project.id))
      flash(`Imported ${next.floors.length} floors · ${scopes} scopes`, true)
    } catch (e) {
      flash(`Import failed: ${(e as Error).message}`, false)
    }
  }

  return (
    <div className="datamenu">
      <input ref={fileInput} type="file"
        accept=".csv,.json,.xlsx,.xls,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      {canEdit && <button className="btn" onClick={() => fileInput.current?.click()}>Import</button>}
      <button className="btn secondary" onClick={() => download('oneview-template.csv', TEMPLATE_CSV, 'text/csv')}>Template</button>
      <button className="btn secondary" onClick={() => download(`${building.name}.csv`, csvFromBuilding(building), 'text/csv')}>Export</button>
      {msg && <span className="datamenu-msg" style={{ color: msg.ok ? 'var(--ok)' : 'var(--alarm)' }}>{msg.text}</span>}
    </div>
  )
}
