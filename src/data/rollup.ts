// Pure progress + status roll-up helpers. No data-source dependency, so views can
// import these whether data comes from the API, an import, or the demo.

import type { Area, Building, Floor, ProgressStatus } from './types'

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

export function areaPunch(a: Area): number {
  return a.scopes.reduce((n, s) => n + (s.openPunch ?? 0), 0)
}
export function floorPunch(f: Floor): number {
  return f.areas.reduce((n, a) => n + areaPunch(a), 0)
}
