# OneView

A navigable **building progress & turnover tracker** with user accounts and multiple
projects. Sign in, create a project, click into floors → areas → work scopes, and track
imported **% complete**, **turnover status**, open punch items, dates and notes.
Upload a floor-plan image and **trace areas** directly on it. All data is stored on a
backend and shared across devices/users.

## Architecture

```
Browser (React + TS, Vite)  ──/api──▶  Express backend  ──▶  JSON data store + /uploads
   auth token (JWT)                     accounts, projects,        (server/data/, gitignored)
   per-project views                    floor-plan uploads
```

- **Frontend** — React 18 + TypeScript + react-router, SVG vector graphics
- **Backend** — Express, JWT auth (bcrypt-hashed passwords), multer image uploads
- **Storage** — a JSON file (`server/data/db.json`) behind a small accessor layer, so it
  can be swapped for Postgres later without touching routes. Uploaded plans live in
  `server/data/uploads/`.

## Features

- **Accounts** — register / sign in; projects are private to you and people you share with
- **Multiple projects** — project list with per-project % complete; create / open / delete
- **Sharing & roles** — owner can add members as `editor` or `viewer` (view-only locks editing)
- **Project dashboard** — overall % complete, status breakdown, by-floor & by-discipline
  progress, open-punch/turned-over KPIs, and an **S-curve** of progress over time
- **Schedule view** — a sortable, filterable table of every scope in the building
  (by status, discipline, or text), with click-through to the scope and CSV export of the view
- **Per-scope detail** — punch list (real items, not just a count), **photo attachments**,
  a **comments timeline**, progress %, status, contractor, and turnover dates
- **Tabbed navigation** — Overview / Building / Schedule, with deep-links to a scope
- **Drill-down** — building → floor → area → scope, with breadcrumbs, search, and status roll-up
- **Floor-plan upload + tracing** — upload an image per floor, then drag rectangles to trace
  clickable areas over it (rename / delete in edit mode)
- **Editable turnover info** — progress %, status, contractor, dates, punch items, notes
- **Excel / CSV / JSON import + export** — bulk-load a whole building from a spreadsheet (see below)
- **Auto-save** — every change is saved to the backend (debounced); a status shows "Saving…/Saved"

## Run it (development)

```bash
npm install
npm run dev      # starts BOTH the web app (5173) and the API (8787) together
```

Open http://localhost:5173. The Vite dev server proxies `/api` and `/uploads` to the
backend on 8787.

Other scripts: `npm run web` (frontend only), `npm run server` (API only),
`npm run build` (type-check + production build).

## Deploy to Render

A `render.yaml` blueprint is included. In production the Express server honours Render's
`PORT` and serves both the API and the built SPA from one process.

1. **Push to GitHub** (Render deploys from a Git repo):
   ```bash
   git init && git add -A && git commit -m "OneView"
   git remote add origin https://github.com/<you>/oneview.git
   git push -u origin main
   ```
2. In Render: **New → Blueprint**, pick the repo. It reads `render.yaml` and provisions a
   web service **plus a free PostgreSQL database**, with an auto-generated `JWT_SECRET` and
   `DATABASE_URL` wired in automatically.
3. Deploy. First build runs `npm install && npm run build`, then `npm start`.

**Persistence:** the web service's filesystem is ephemeral (wiped on deploy/restart/sleep),
so all data — accounts, projects, and uploaded floor plans — lives in **PostgreSQL**. The
backend uses Postgres whenever `DATABASE_URL` is set and falls back to a JSON file for local
dev. The free web service still **sleeps after ~15 min idle** (~30s cold start), but your
data is safe across restarts and redeploys.

**Database longevity:** Render's *free* Postgres is free only for a limited window (see
Render's pricing). For a database that stays free indefinitely, create one at
[Neon](https://neon.tech) or [Supabase](https://supabase.com) and set `DATABASE_URL` to its
connection string (remove the `databases:` block from `render.yaml`).

Env vars (set by the blueprint): `JWT_SECRET` (generated), `DATABASE_URL` (from the DB),
`NODE_VERSION`. `PORT` is provided by Render.

### Run a production build locally
```bash
npm run build && npm start   # serves API + SPA on PORT (default 8787)
```

For larger multi-user scale later, swap the JSON store in `server/src/db.ts` for Postgres
(the accessor functions are the only thing that changes) and move uploads to object storage.

## Importing your data

Toolbar → **Template** downloads a formatted **Excel template** (`OneView-template.xlsx`)
with an *Instructions* sheet and example rows; **CSV** downloads the same as a plain `.csv`.
Fill it in, then **Import**. Import accepts **Excel (`.xlsx`/`.xls`), `.csv`, or a OneView
`.json` export** — for Excel, the first sheet whose header has Floor/Area/Scope is used
(so an Instructions sheet is skipped). One row per work scope:

`Floor, Level, Area, Scope, Discipline, Status, Progress, Contractor, Responsible, Start, Target, Turnover, Punch, Notes, Comments`

- Only `Floor`, `Area`, `Scope` are required; columns can be in any order; status/discipline
  accept friendly spellings; floor/area layouts are generated automatically.
- **`Punch`** accepts either a **number** (open count) or a **list of items** separated by
  `;` (e.g. `Replace gauge; Label valves`) — a list becomes real punch-list items.
- **`Comments`** is an optional `;`-separated list; each becomes a comment on the scope.
- **Export** writes the current building back to CSV in the same shape (punch items and
  comments included), so you can round-trip.

### Floor stacking (the `Level` column)

Floors are stacked by `Level`: **higher number = higher in the building**, ground = `0`,
basement = negative (e.g. `-1`). Put the **same number on every row of a floor**:

| Floor | Level |
| --- | --- |
| Roof Plant | 4 |
| Level 3 | 3 |
| Ground | 0 |
| Basement | -1 |

If you leave `Level` blank, OneView **infers it from the floor name** — `Roof`/`Penthouse`/`Plant`
go on top, `Ground`/`Mezzanine` = 0, `Basement 2`/`B2` = -2, and a number in the name
(`Level 3`, `L2`, `3rd Floor`) is used directly. So well-named floors stack correctly even
without the column. The parsed level is shown on each floor in the building view, so you can
confirm the stacking is right. (Floors with no level and no number in the name fall back to
the order they appear in the file.) (Tracing on an
uploaded plan is the alternative to auto-layout when you want areas to match the real plan.)

## Project structure

```
server/src/
  index.ts   Express app: auth, projects, upload, static
  db.ts      JSON data store + access helpers (the swap-to-Postgres seam)
  auth.ts    password hashing + JWT middleware
src/
  api.ts     typed backend client + route-path helpers
  auth.tsx   auth context (token, current user)
  data/
    types.ts      Building → Floor → Area → Scope
    rollup.ts     pure progress/status roll-up
    store.tsx     per-project store: load from API + debounced save
    io.ts         CSV/JSON import + export
  components/
    AuthPage / ProjectList                 sign-in + project picker
    BuildingView / FloorView / RoomView    the drill-down views (FloorView has tracing)
    ScopeDetail / DataMenu / Breadcrumbs / StatusBadge
  App.tsx    auth gate, routing, project-scoped layout
```

## Roadmap

- Per-scope punch-list detail; documents / photos attached to a scope
- Dashboard summary (S-curve, % complete over time), PDF turnover reports
- Polygon tracing (irregular rooms); 3D building view; desktop (Electron) packaging
- Postgres + object storage for production scale
