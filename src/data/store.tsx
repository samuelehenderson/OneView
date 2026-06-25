import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Building, Floor, Scope } from './types'
import { api, type Project } from '../api'

// Re-export the pure roll-up helpers so existing views keep importing from here.
export {
  areaProgress, areaStatus, floorProgress, floorStatus, buildingProgress, areaPunch, floorPunch,
} from './rollup'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface StoreApi {
  project: Project
  building: Building
  canEdit: boolean
  saveState: SaveState
  updateScope: (scopeId: string, patch: Partial<Scope>) => void
  updateFloor: (floorId: string, patch: Partial<Floor>) => void
  replaceBuilding: (b: Building) => void
}

const StoreCtx = createContext<StoreApi | null>(null)

export function ProjectProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null)
  const [building, setBuilding] = useState<Building | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setProject(null)
    setBuilding(null)
    setError(null)
    api
      .getProject(projectId)
      .then(({ project }) => {
        if (cancelled) return
        setProject(project)
        setBuilding(project.building)
      })
      .catch((e) => !cancelled && setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [projectId])

  const canEdit = !!project && project.myRole !== 'viewer'

  // Apply a local change and schedule a debounced save to the server.
  const commit = (next: Building) => {
    setBuilding(next)
    if (!canEdit) return
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      api
        .saveProject(projectId, { building: next })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 700)
  }

  const updateScope: StoreApi['updateScope'] = (scopeId, patch) => {
    if (!building) return
    commit({
      ...building,
      floors: building.floors.map((f) => ({
        ...f,
        areas: f.areas.map((a) => ({
          ...a,
          scopes: a.scopes.map((s) => (s.id === scopeId ? { ...s, ...patch } : s)),
        })),
      })),
    })
  }

  const updateFloor: StoreApi['updateFloor'] = (floorId, patch) => {
    if (!building) return
    commit({ ...building, floors: building.floors.map((f) => (f.id === floorId ? { ...f, ...patch } : f)) })
  }

  const replaceBuilding: StoreApi['replaceBuilding'] = (b) => commit(b)

  if (error) return <div className="empty" style={{ padding: 40 }}>Couldn’t load project: {error}</div>
  if (!project || !building) return <div className="empty" style={{ padding: 40 }}>Loading project…</div>

  return (
    <StoreCtx.Provider value={{ project, building, canEdit, saveState, updateScope, updateFloor, replaceBuilding }}>
      {children}
    </StoreCtx.Provider>
  )
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within ProjectProvider')
  return ctx
}
