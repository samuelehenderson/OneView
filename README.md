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
- **Drill-down** — building → floor → area → scope, with breadcrumbs, search, and status roll-up
- **Floor-plan upload + tracing** — upload an image per floor, then drag rectangles to trace
  clickable areas over it (rename / delete in edit mode)
- **Editable turnover info** — progress %, status, contractor, dates, punch items, notes
- **CSV / JSON import + export** — bulk-load a whole building from a spreadsheet (see below)
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
   web service with an auto-generated `JWT_SECRET`.
3. Deploy. First build runs `npm install && npm run build`, then `npm start`.

**The committed `render.yaml` targets Render's FREE tier.** That means:
- **No persistence** — the database and uploaded floor plans sit on an ephemeral disk and
  are **wiped on every deploy/restart**. Accounts/projects/uploads won't survive a redeploy.
- The service **sleeps after ~15 min idle** and takes ~30s to wake.

To make data persist (on a paid Starter ~$7/mo), add a persistent disk — see the commented
block at the top of `render.yaml`: re-add `plan: starter`, the `DATA_DIR=/data` env var, and
the `disk:` block, then redeploy. For free persistence instead, migrate the store in
`server/src/db.ts` to Render's free PostgreSQL (and store uploads in the DB or object storage).

Env vars (set by the blueprint): `JWT_SECRET` (generated), `NODE_VERSION`. `PORT` is
provided by Render.

### Run a production build locally
```bash
npm run build && npm start   # serves API + SPA on PORT (default 8787)
```

For larger multi-user scale later, swap the JSON store in `server/src/db.ts` for Postgres
(the accessor functions are the only thing that changes) and move uploads to object storage.

## Importing your data

Toolbar → **Template** downloads `oneview-template.csv`; fill it in (Excel / Sheets) and
**Import**. One row per work scope:

`Floor, Level, Area, Scope, Discipline, Status, Progress, Contractor, Responsible, Start, Target, Turnover, Punch, Notes`

Only `Floor`, `Area`, `Scope` are required; columns can be in any order; status/discipline
accept friendly spellings. Floor/area layouts are generated automatically. (Tracing on an
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
