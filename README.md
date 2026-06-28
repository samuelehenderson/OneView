# GhostMap

**Reverse-engineer a building from its control program.** GhostMap is read-only static
analysis over a Siemens field-panel **PPCL** program: drop in a panel's listing (`.pcl`) or
a PXC-Modular backup (`.P2`) and get a clickable causal map of *what drives what*, the
overrides and dead code nobody documented, and the cross-panel dependencies across a campus.

The full app, the analysis engine, and the story behind it live in
**[`ghostmap/`](./ghostmap/)** — start with [`ghostmap/README.md`](./ghostmap/README.md).

```
Browser: GhostMap static app  ──/api──▶  Express backend  ──▶  Postgres (or JSON file)
  deterministic PPCL analysis     JWT auth, saved buildings as the system-of-record
  + in-browser .P2 decoding
```

- **Frontend** — `ghostmap/index.html`, a self-contained app (deterministic PPCL parser +
  dependency/control-flow graph, Point Inspector, forensic findings, campus cross-refs,
  in-browser `.P2` decoding). No build step.
- **Backend** — `server/` — Express + JWT auth (bcrypt), storing each saved **building**
  (`{ kind:'ghostmap', programs:[{name, source}] }`) per user. Backend is **Postgres** when
  `DATABASE_URL` is set, else a local **JSON file** for zero-setup local runs.

## Run it

```bash
npm install
npm start          # serves the GhostMap app + API at http://localhost:8787
```

Open <http://localhost:8787>. It loads with real sample panels; sign in (top right) to save
your own buildings, or just **Open file…** a `.pcl`/`.P2` to analyze locally.

For development with auto-reload: `npm run dev`.

## Deploy

`render.yaml` is a Render blueprint: `npm install` then `npm start`. Set `DATABASE_URL`
(e.g. a free Neon Postgres) for persistence; `JWT_SECRET` is generated. Health check at
`/api/health`.

## Also in this repo

- [`cfc-simulator/`](./cfc-simulator/) — an earlier PXC tool: a Continuous Function Chart
  editor/scan-simulator plus a line-numbered PPCL interpreter. Standalone, kept for reference.

---

> History: this repo began as *OneView*, a construction turnover tracker. It was
> deliberately repurposed into GhostMap; the turnover frontend has been retired.
