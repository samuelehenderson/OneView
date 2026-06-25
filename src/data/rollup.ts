// Pure progress + status roll-up helpers. No data-source dependency, so views can
// import these whether data comes from the API, an import, or the demo.

import type { Area, Building, Floor, ProgressStatus, Scope, ScopeType } from './types'

function avg(progresses: number[]): number {
  if (progresses.length === 0) return 0
  return Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length)
}

function rollUpStatus(statuses: ProgressStatus[], progress: number): ProgressStatus {
  if (statuses.includes('on-hold')) return 'on-hold'
  if (statuses.length === 0) return 'not-started'
  if (progress >= 100) return 'turned-over'
  if (statuses.every((s) => s === 'not-started')) return 'not-started'
  if (statuses.every((s) => s === 'turned-over' || s === 'commissioning')) return 'commissioning'
  return 'in-progress'
}

export function areaProgress(a: Area): number {
  return avg(a.scopes.map((s) => s.progress))
}
export function areaStatus(a: Area): ProgressStatus {
  return rollUpStatus(a.scopes.map((s) => s.status), areaProgress(a))
}
export function floorProgress(f: Floor): number {
  return avg(f.areas.flatMap((a) => a.scopes.map((s) => s.progress)))
}
export function floorStatus(f: Floor): ProgressStatus {
  return rollUpStatus(f.areas.flatMap((a) => a.scopes.map((s) => s.status)), floorProgress(f))
}
export function buildingProgress(b: Building): number {
  return avg(b.floors.flatMap((f) => f.areas.flatMap((a) => a.scopes.map((s) => s.progress))))
}

/** Open punch count for a scope — from the punch list if present, else the legacy count. */
export function scopeOpenPunch(s: Scope): number {
  if (s.punchList && s.punchList.length) return s.punchList.filter((p) => !p.done).length
  return s.openPunch ?? 0
}
export function areaPunch(a: Area): number {
  return a.scopes.reduce((n, s) => n + scopeOpenPunch(s), 0)
}
export function floorPunch(f: Floor): number {
  return f.areas.reduce((n, a) => n + areaPunch(a), 0)
}
export function buildingPunch(b: Building): number {
  return b.floors.reduce((n, f) => n + floorPunch(f), 0)
}

// ---- Flattening + breakdowns (dashboard / schedule) -------------------------

export interface FlatScope {
  scope: Scope
  floorId: string
  floorName: string
  level: number
  areaId: string
  areaName: string
}

/** Every scope in the building with its floor/area context, top floor first. */
export function flattenScopes(b: Building): FlatScope[] {
  const out: FlatScope[] = []
  for (const f of [...b.floors].sort((a, c) => c.level - a.level))
    for (const a of f.areas)
      for (const scope of a.scopes)
        out.push({ scope, floorId: f.id, floorName: f.name, level: f.level, areaId: a.id, areaName: a.name })
  return out
}

const ALL_STATUSES: ProgressStatus[] = ['not-started', 'in-progress', 'commissioning', 'turned-over', 'on-hold']

/** Count of scopes in each status. */
export function statusCounts(b: Building): Record<ProgressStatus, number> {
  const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<ProgressStatus, number>
  for (const { scope } of flattenScopes(b)) counts[scope.status]++
  return counts
}

/** Average % complete grouped by discipline, with scope counts. */
export function disciplineBreakdown(b: Building): { type: ScopeType; pct: number; count: number }[] {
  const groups = new Map<ScopeType, number[]>()
  for (const { scope } of flattenScopes(b)) {
    if (!groups.has(scope.type)) groups.set(scope.type, [])
    groups.get(scope.type)!.push(scope.progress)
  }
  return [...groups.entries()]
    .map(([type, ps]) => ({ type, count: ps.length, pct: Math.round(ps.reduce((a, c) => a + c, 0) / ps.length) }))
    .sort((a, c) => c.count - a.count)
}

export const totalScopes = (b: Building) => flattenScopes(b).length

/** A scope is overdue if it has a target date in the past and isn't turned over. */
export function isOverdue(s: Scope, today = new Date().toISOString().slice(0, 10)): boolean {
  return !!s.targetDate && s.status !== 'turned-over' && s.targetDate < today
}
export function overdueCount(b: Building): number {
  return flattenScopes(b).filter((f) => isOverdue(f.scope)).length
}
