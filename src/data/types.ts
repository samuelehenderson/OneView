// Core domain model for OneView.
// OneView tracks construction / fit-out PROGRESS and TURNOVER status across a building.
// Everything is a tree: Building → Floor → Area (room) → Scope (a work item / discipline).
// All values are imported / entered — there is no live data.

export type ProgressStatus =
  | 'not-started'
  | 'in-progress'
  | 'commissioning'
  | 'turned-over'
  | 'on-hold'

/** Discipline / trade of a work scope, used only to pick an icon + label. */
export type ScopeType =
  | 'structure'
  | 'hvac'
  | 'electrical'
  | 'plumbing'
  | 'fire'
  | 'finishes'
  | 'it-data'
  | 'fitout'

/** A punch-list (snag) item against a scope. */
export interface PunchItem {
  id: string
  text: string
  done: boolean
  createdAt: string
}

/** An uploaded photo or document attached to a scope. */
export interface Attachment {
  id: string
  url: string
  name: string
  /** 'image' renders as a thumbnail; 'file' as a link. */
  kind: 'image' | 'file'
}

/** A dated comment on a scope. */
export interface Comment {
  id: string
  text: string
  author: string
  at: string
}

/** A single tracked work item within an area (e.g. "HVAC", "Electrical fit-out"). */
export interface Scope {
  id: string
  name: string
  type: ScopeType
  /** Position within the area SVG (0–100 in both axes, treated as a percentage). */
  x: number
  y: number
  status: ProgressStatus
  /** Percent complete, 0–100. */
  progress: number
  // --- Imported / editable info ---
  contractor?: string
  responsible?: string
  startDate?: string
  targetDate?: string
  turnoverDate?: string
  /** Legacy/simple open punch count. Used when punchList is absent. */
  openPunch?: number
  notes?: string
  // --- Rich detail (all optional, added incrementally) ---
  punchList?: PunchItem[]
  attachments?: Attachment[]
  comments?: Comment[]
}

export interface Area {
  id: string
  name: string
  /** Rectangle on the floor plan, as percentages of the floor SVG viewBox. */
  x: number
  y: number
  w: number
  h: number
  scopes: Scope[]
}

export interface Floor {
  id: string
  name: string
  /** Higher level = higher up the building graphic. Ground = 0. */
  level: number
  areas: Area[]
  /** Optional uploaded floor-plan image (URL), shown behind the traced areas. */
  planImage?: string
}

export interface Building {
  id: string
  name: string
  address: string
  floors: Floor[]
}
