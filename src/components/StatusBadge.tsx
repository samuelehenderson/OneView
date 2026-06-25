import type { ProgressStatus } from '../data/types'

const labels: Record<ProgressStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  commissioning: 'Commissioning',
  'turned-over': 'Turned Over',
  'on-hold': 'On Hold',
}

export const statusColor: Record<ProgressStatus, string> = {
  'not-started': 'var(--muted)',
  'in-progress': 'var(--accent)',
  commissioning: 'var(--warning)',
  'turned-over': 'var(--ok)',
  'on-hold': 'var(--alarm)',
}

export const statusLabel = (s: ProgressStatus) => labels[s]

export function StatusBadge({ status }: { status: ProgressStatus }) {
  const cls: Record<ProgressStatus, string> = {
    'not-started': 'offline',
    'in-progress': 'info',
    commissioning: 'warning',
    'turned-over': 'ok',
    'on-hold': 'alarm',
  }
  return <span className={`pill ${cls[status]}`}>{labels[status]}</span>
}
