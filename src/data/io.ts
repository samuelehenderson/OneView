// Import / export for OneView.
//
// Primary format is a flat CSV (one row per work scope) so it can be authored in
// Excel / Google Sheets. Floor/area geometry is generated automatically — the file
// only carries data, not drawing coordinates. A full-fidelity JSON Building object
// is also accepted (e.g. re-importing an export).

import type { Area, Building, Floor, ProgressStatus, Scope, ScopeType } from './types'

// ---- Column order for CSV (header row) --------------------------------------

export const CSV_COLUMNS = [
  'Floor',
  'Level',
  'Area',
  'Scope',
  'Discipline',
  'Status',
  'Progress',
  'Contractor',
  'Responsible',
  'Start',
  'Target',
  'Turnover',
  'Punch',
  'Notes',
] as const

// ---- Normalisers (accept friendly spellings) --------------------------------

const STATUS_MAP: Record<string, ProgressStatus> = {
  'not started': 'not-started', 'not-started': 'not-started', notstarted: 'not-started', '': 'not-started',
  'in progress': 'in-progress', 'in-progress': 'in-progress', inprogress: 'in-progress', wip: 'in-progress',
  commissioning: 'commissioning', cx: 'commissioning', commissioned: 'commissioning',
  'turned over': 'turned-over', 'turned-over': 'turned-over', turnedover: 'turned-over',
  complete: 'turned-over', completed: 'turned-over', done: 'turned-over', 'handed over': 'turned-over',
  'on hold': 'on-hold', 'on-hold': 'on-hold', onhold: 'on-hold', hold: 'on-hold',
}

const DISCIPLINE_MAP: Record<string, ScopeType> = {
  hvac: 'hvac', mechanical: 'hvac', mech: 'hvac',
  electrical: 'electrical', elec: 'electrical', power: 'electrical',
  fire: 'fire', fls: 'fire', 'fire & life safety': 'fire', 'life safety': 'fire',
  plumbing: 'plumbing', plumb: 'plumbing', hydraulic: 'plumbing',
  finishes: 'finishes', finish: 'finishes', interior: 'finishes', interiors: 'finishes',
  structure: 'structure', structural: 'structure',
  it: 'it-data', data: 'it-data', 'it-data': 'it-data', comms: 'it-data', bms: 'it-data',
  fitout: 'fitout', 'fit-out': 'fitout', 'fit out': 'fitout',
}

const normStatus = (s: string): ProgressStatus => STATUS_MAP[s.trim().toLowerCase()] ?? 'not-started'
const normDiscipline = (s: string): ScopeType => DISCIPLINE_MAP[s.trim().toLowerCase()] ?? 'fitout'
const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(isFinite(n) ? n : 0)))

// When the Level column is blank, infer a stacking level from the floor name so floors
// still stack correctly. Higher number = higher in the building. Returns null if unknown.
export function deriveLevel(name: string): number | null {
  const n = name.toLowerCase()
  if (/\b(roof|rooftop|penthouse|ph|plant)\b/.test(n)) return 100
  const b = n.match(/\bb(?:asement)?\s*-?(\d+)\b/) // "Basement 2", "B2"
  if (b) return -Number(b[1])
  if (/\b(lower ground|basement|sub-?basement)\b/.test(n)) return -1
  if (/\b(ground|gf|g\/f|mezz(anine)?)\b/.test(n)) return 0
  const m = n.match(/-?\d+/) // "Level 3", "L2", "3rd Floor", "Floor 12"
  return m ? Number(m[0]) : null
}

// ---- CSV parsing (handles quotes, embedded commas, CRLF) ---------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/^﻿/, '') // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* ignore, handled by \n */ }
    else field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

// ---- Auto-layout (data → drawing coordinates) -------------------------------

function gridCols(n: number): number {
  return n <= 1 ? 1 : n <= 4 ? 2 : 3
}

// Areas occupy a grid on the 0–100 floor plan.
function areaBox(i: number, n: number) {
  const cols = gridCols(n)
  const rows = Math.ceil(n / cols)
  const m = 3, gap = 3
  const w = (100 - 2 * m - (cols - 1) * gap) / cols
  const h = (100 - 2 * m - (rows - 1) * gap) / rows
  const col = i % cols
  const rowIdx = Math.floor(i / cols)
  return { x: m + col * (w + gap), y: m + rowIdx * (h + gap), w, h }
}

// Scope centres on a 0–100 grid within an area view.
function scopePos(i: number, n: number) {
  const cols = n <= 1 ? 1 : 2
  const rows = Math.ceil(n / cols)
  const col = i % cols
  const rowIdx = Math.floor(i / cols)
  return { x: ((col + 0.5) / cols) * 100, y: ((rowIdx + 0.5) / rows) * 100 }
}

// ---- CSV → Building ----------------------------------------------------------

let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`

interface RawScope extends Omit<Scope, 'id' | 'x' | 'y'> {}

export function buildingFromCsv(text: string, name = 'Imported Building', address = 'Imported'): Building {
  return buildingFromRows(parseCsv(text), name, address)
}

// Shared by CSV and XLSX: takes a header row + data rows (already split into cells).
export function buildingFromRows(rows: string[][], name = 'Imported Building', address = 'Imported'): Building {
  if (rows.length < 2) throw new Error('File is empty or has no data rows.')

  // Map header names to indices (case-insensitive), so column order can vary.
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (k: string) => header.indexOf(k.toLowerCase())
  const need = ['floor', 'area', 'scope']
  for (const k of need) if (col(k) === -1) throw new Error(`Missing required column "${k}" (need Floor, Area, Scope).`)
  const get = (r: string[], k: string) => {
    const i = col(k)
    return i === -1 ? '' : (r[i] ?? '').trim()
  }

  // Group rows: floor → area → scopes, preserving first-seen order.
  // Level resolution per floor: explicit Level number → inferred from the floor name → row order.
  const floors = new Map<string, { level: number; levelExplicit: boolean; order: number; areas: Map<string, RawScope[]> }>()
  for (const r of rows.slice(1)) {
    const floorName = get(r, 'floor')
    const areaName = get(r, 'area')
    const scopeName = get(r, 'scope')
    if (!floorName || !areaName || !scopeName) continue
    const levelRaw = get(r, 'level')
    const parsed = levelRaw === '' ? NaN : Number(levelRaw)
    const explicit = isFinite(parsed)
    if (!floors.has(floorName)) {
      const order = floors.size
      const level = explicit ? parsed : deriveLevel(floorName) ?? order
      floors.set(floorName, { level, levelExplicit: explicit, order, areas: new Map() })
    } else {
      // A later row may supply the explicit level the first row for this floor lacked.
      const f = floors.get(floorName)!
      if (!f.levelExplicit && explicit) { f.level = parsed; f.levelExplicit = true }
    }
    const f = floors.get(floorName)!
    if (!f.areas.has(areaName)) f.areas.set(areaName, [])
    f.areas.get(areaName)!.push({
      name: scopeName,
      type: normDiscipline(get(r, 'discipline')),
      status: normStatus(get(r, 'status')),
      progress: clampPct(Number(get(r, 'progress'))),
      contractor: get(r, 'contractor') || undefined,
      responsible: get(r, 'responsible') || undefined,
      startDate: get(r, 'start') || undefined,
      targetDate: get(r, 'target') || undefined,
      turnoverDate: get(r, 'turnover') || undefined,
      openPunch: Number(get(r, 'punch')) || 0,
      notes: get(r, 'notes') || '',
    })
  }

  const builtFloors: Floor[] = [...floors.entries()]
    // Highest level on top; ties keep their first-seen order.
    .sort((a, b) => b[1].level - a[1].level || a[1].order - b[1].order)
    .map(([floorName, f]) => {
      const areaEntries = [...f.areas.entries()]
      const areas: Area[] = areaEntries.map(([areaName, scopes], ai) => {
        const box = areaBox(ai, areaEntries.length)
        return {
          id: uid('ar'),
          name: areaName,
          ...box,
          scopes: scopes.map((s, si) => ({ id: uid('sc'), ...scopePos(si, scopes.length), ...s })),
        }
      })
      return { id: uid('fl'), name: floorName, level: f.level, areas }
    })

  if (builtFloors.length === 0) throw new Error('No valid rows found (need Floor, Area, Scope).')
  return { id: 'bldg-import', name, address, floors: builtFloors }
}

// ---- Building → CSV (export) -------------------------------------------------

function csvCell(v: string | number | undefined): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvFromBuilding(b: Building): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const f of b.floors)
    for (const a of f.areas)
      for (const s of a.scopes)
        lines.push(
          [f.name, f.level, a.name, s.name, s.type, s.status, s.progress, s.contractor, s.responsible, s.startDate, s.targetDate, s.turnoverDate, s.openPunch, s.notes]
            .map(csvCell)
            .join(','),
        )
  return lines.join('\n')
}

// ---- XLSX (Excel) ------------------------------------------------------------

// Parse the first sheet of an .xlsx/.xls workbook into rows, then reuse buildingFromRows.
// SheetJS is loaded on demand so it stays out of the initial bundle.
export async function buildingFromXlsx(buffer: ArrayBuffer, name = 'Imported Building'): Promise<Building> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('The workbook has no sheets.')
  // header:1 → array-of-arrays; defval keeps empty cells aligned; everything as strings.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
  const stringRows = rows.map((r) => r.map((c) => (c == null ? '' : String(c))))
  return buildingFromRows(stringRows, name)
}

// ---- Detect & dispatch (reads the File itself) -------------------------------

export async function buildingFromUpload(file: File): Promise<Building> {
  const base = file.name.replace(/\.[^.]+$/, '') || 'Imported Building'
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return buildingFromXlsx(await file.arrayBuffer(), base)
  }
  const text = await file.text()
  if (lower.endsWith('.json')) {
    const obj = JSON.parse(text)
    if (!obj || !Array.isArray(obj.floors)) throw new Error('JSON is not a OneView building (missing "floors").')
    return obj as Building
  }
  return buildingFromCsv(text, base)
}

// ---- Starter template --------------------------------------------------------

export const TEMPLATE_CSV = `Floor,Level,Area,Scope,Discipline,Status,Progress,Contractor,Responsible,Start,Target,Turnover,Punch,Notes
Level 1,1,Open Office,HVAC,HVAC,In Progress,60,CoolAir Mechanical,J. Smith,2026-02-01,2026-06-15,,2,Ductwork in progress
Level 1,1,Open Office,Electrical,Electrical,In Progress,45,Voltline Electrical,A. Patel,2026-02-01,2026-06-15,,0,
Level 1,1,Open Office,Fire,Fire,Not Started,0,SafeGuard Fire,,2026-04-01,2026-06-20,,0,
Level 1,1,Meeting Room,Finishes,Finishes,Commissioning,90,Apex Interiors,,2026-03-01,2026-06-10,,3,Snagging underway
Level 2,2,Open Office,HVAC,HVAC,Turned Over,100,CoolAir Mechanical,,2026-01-15,2026-05-01,2026-04-30,0,Handed over
Level 2,2,Server Room,IT-Data,IT,On Hold,20,Integrated Controls,,2026-03-01,2026-06-20,,1,Awaiting client sign-off
`
