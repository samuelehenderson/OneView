import type { Area, Building, ProgressStatus, Scope, ScopeType } from './types'

// A mock building fit-out project. This is the "single source of truth" for the demo.
// In a real deployment this comes from an imported schedule / spreadsheet, not live data.

let seq = 0
const uid = (p: string) => `${p}-${++seq}`

interface ScopeSpec {
  name: string
  type: ScopeType
  x: number
  y: number
  status: ProgressStatus
  progress: number
  contractor?: string
  responsible?: string
  startDate?: string
  targetDate?: string
  turnoverDate?: string
  openPunch?: number
  notes?: string
}

function scope(s: ScopeSpec): Scope {
  return { id: uid('sc'), notes: '', openPunch: 0, ...s }
}

// A reusable set of work scopes for a typical office floor, parameterised by how far along it is.
function officeArea(stage: 'done' | 'cx' | 'wip' | 'early'): Area['scopes'] {
  const presets: Record<typeof stage, Partial<ScopeSpec>[]> = {
    done: [
      { status: 'turned-over', progress: 100, turnoverDate: '2026-04-30' },
      { status: 'turned-over', progress: 100, turnoverDate: '2026-05-05' },
      { status: 'turned-over', progress: 100, turnoverDate: '2026-05-02' },
      { status: 'turned-over', progress: 100, turnoverDate: '2026-05-10' },
    ],
    cx: [
      { status: 'turned-over', progress: 100, turnoverDate: '2026-05-20' },
      { status: 'commissioning', progress: 85, openPunch: 4 },
      { status: 'commissioning', progress: 90, openPunch: 2 },
      { status: 'in-progress', progress: 70 },
    ],
    wip: [
      { status: 'in-progress', progress: 60 },
      { status: 'in-progress', progress: 45 },
      { status: 'in-progress', progress: 55, openPunch: 6 },
      { status: 'not-started', progress: 0 },
    ],
    early: [
      { status: 'in-progress', progress: 20 },
      { status: 'not-started', progress: 0 },
      { status: 'on-hold', progress: 10, notes: 'Awaiting RFI response on duct routing.' },
      { status: 'not-started', progress: 0 },
    ],
  }
  const base: { name: string; type: ScopeType; x: number; y: number; contractor: string }[] = [
    { name: 'HVAC', type: 'hvac', x: 25, y: 30, contractor: 'CoolAir Mechanical' },
    { name: 'Electrical', type: 'electrical', x: 70, y: 30, contractor: 'Voltline Electrical' },
    { name: 'Fire & Life Safety', type: 'fire', x: 25, y: 70, contractor: 'SafeGuard Fire' },
    { name: 'Finishes & Fit-out', type: 'finishes', x: 70, y: 70, contractor: 'Apex Interiors' },
  ]
  return base.map((b, i) =>
    scope({
      status: 'not-started',
      progress: 0,
      startDate: '2026-02-01',
      targetDate: '2026-06-15',
      ...b,
      ...presets[stage][i],
    }),
  )
}

function area(name: string, x: number, y: number, w: number, h: number, scopes: Scope[]): Area {
  return { id: uid('ar'), name, x, y, w, h, scopes }
}

export const building: Building = {
  id: 'bldg-1',
  name: 'Aurora Tower',
  address: '1 Innovation Way — Fit-out Project',
  floors: [
    {
      id: 'floor-plant',
      name: 'Roof Plant',
      level: 4,
      areas: [
        area('Plant Room', 8, 10, 84, 70, [
          scope({ name: 'Chillers & Pumps', type: 'hvac', x: 25, y: 35, status: 'commissioning', progress: 80, contractor: 'CoolAir Mechanical', startDate: '2026-01-10', targetDate: '2026-06-10', openPunch: 7 }),
          scope({ name: 'AHUs', type: 'hvac', x: 60, y: 35, status: 'commissioning', progress: 88, contractor: 'CoolAir Mechanical', startDate: '2026-01-10', targetDate: '2026-06-10', openPunch: 3 }),
          scope({ name: 'Main Switchgear', type: 'electrical', x: 25, y: 70, status: 'turned-over', progress: 100, contractor: 'Voltline Electrical', turnoverDate: '2026-05-15' }),
          scope({ name: 'BMS Head-end', type: 'it-data', x: 60, y: 70, status: 'in-progress', progress: 65, contractor: 'Integrated Controls', startDate: '2026-03-01', targetDate: '2026-06-20', notes: 'Graphics build underway.' }),
        ]),
      ],
    },
    { id: 'floor-3', name: 'Level 3 — Offices', level: 3, areas: officeFloor('done') },
    { id: 'floor-2', name: 'Level 2 — Offices', level: 2, areas: officeFloor('cx') },
    { id: 'floor-1', name: 'Level 1 — Offices', level: 1, areas: officeFloor('wip') },
    {
      id: 'floor-g',
      name: 'Ground — Lobby & Retail',
      level: 0,
      areas: [
        area('Lobby', 4, 6, 56, 60, officeArea('cx')),
        area('Retail Unit', 64, 6, 32, 60, officeArea('early')),
        area('Main Switchroom', 4, 70, 92, 24, [
          scope({ name: 'Main Distribution', type: 'electrical', x: 30, y: 50, status: 'turned-over', progress: 100, contractor: 'Voltline Electrical', turnoverDate: '2026-04-10' }),
          scope({ name: 'Standby Generator', type: 'electrical', x: 70, y: 50, status: 'commissioning', progress: 92, contractor: 'Voltline Electrical', startDate: '2026-02-15', targetDate: '2026-06-12', openPunch: 1 }),
        ]),
      ],
    },
  ],
}

// Lay out a standard office floor's four areas, all at the same project stage.
function officeFloor(stage: 'done' | 'cx' | 'wip' | 'early'): Area[] {
  return [
    area('Open Office', 4, 6, 50, 54, officeArea(stage)),
    area('Meeting Rooms', 58, 6, 38, 26, officeArea(stage).slice(0, 2)),
    area('Server Room', 58, 36, 38, 24, officeArea(stage).slice(0, 3)),
    area('Corridor & Core', 4, 64, 92, 30, officeArea(stage).slice(0, 2)),
  ]
}

// Flat lookups for navigation / search.
export const floorById = (id: string) => building.floors.find((f) => f.id === id)
export const areaById = (floorId: string, areaId: string) =>
  floorById(floorId)?.areas.find((a) => a.id === areaId)
