import { Link } from 'react-router-dom'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="breadcrumbs">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {c.to && !last ? <Link to={c.to}>{c.label}</Link> : <span className="current">{c.label}</span>}
            {!last && <span className="sep">›</span>}
          </span>
        )
      })}
    </nav>
  )
}
