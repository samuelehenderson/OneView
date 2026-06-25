// Data store with two interchangeable backends, chosen at startup:
//   - PostgreSQL  when DATABASE_URL is set (production / persistent)
//   - JSON file   otherwise (zero-setup local dev)
// All accessors are async so the two backends share one interface.

import { existsSync, mkdirSync, readFileSync, writeFileSync, readFile, writeFile } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data')
export const UPLOADS_DIR = join(DATA_DIR, 'uploads')

export interface User {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: string
}

export type Role = 'editor' | 'viewer'

export interface Project {
  id: string
  name: string
  address: string
  ownerId: string
  members: Record<string, Role>
  building: unknown
  createdAt: string
  updatedAt: string
}

export interface Store {
  init(): Promise<void>
  findUserByEmail(email: string): Promise<User | undefined>
  findUserById(id: string): Promise<User | undefined>
  addUser(u: User): Promise<void>
  listProjectsForUser(userId: string): Promise<Project[]>
  findProject(id: string): Promise<Project | undefined>
  addProject(p: Project): Promise<void>
  saveProject(p: Project): Promise<void>
  removeProject(id: string): Promise<void>
  saveUpload(id: string, mime: string, data: Buffer): Promise<void>
  getUpload(id: string): Promise<{ mime: string; data: Buffer } | undefined>
  /** Record/overwrite today's overall % complete for a project (for the S-curve). */
  recordSnapshot(projectId: string, pct: number): Promise<void>
  getHistory(projectId: string): Promise<{ day: string; pct: number }[]>
}

// ---- Pure permission helpers (operate on an already-loaded Project) ----------
export const canRead = (p: Project, userId: string) => p.ownerId === userId || userId in p.members
export const canWrite = (p: Project, userId: string) => p.ownerId === userId || p.members[userId] === 'editor'

// ---- Infer image mime from a filename/id extension (JSON backend) ------------
const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
}
const mimeFromName = (n: string) => MIME[(n.match(/\.[^.]+$/)?.[0] || '').toLowerCase()] || 'application/octet-stream'

// ============================ JSON-file backend ==============================

function jsonStore(): Store {
  const DB_FILE = join(DATA_DIR, 'db.json')
  interface Shape { users: User[]; projects: Project[]; snapshots?: Record<string, { day: string; pct: number }[]> }
  const ensureDirs = () => {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true })
  }
  let db: Shape = { users: [], projects: [], snapshots: {} }
  const save = () => writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
  const readFileP = promisify(readFile)
  const writeFileP = promisify(writeFile)

  return {
    async init() {
      ensureDirs()
      if (existsSync(DB_FILE)) {
        try {
          const o = JSON.parse(readFileSync(DB_FILE, 'utf8'))
          db = { users: o.users ?? [], projects: o.projects ?? [], snapshots: o.snapshots ?? {} }
        } catch { /* start empty */ }
      }
      console.log('Store: JSON file at', DB_FILE)
    },
    async findUserByEmail(email) { return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) },
    async findUserById(id) { return db.users.find((u) => u.id === id) },
    async addUser(u) { db.users.push(u); save() },
    async listProjectsForUser(userId) { return db.projects.filter((p) => canRead(p, userId)) },
    async findProject(id) { return db.projects.find((p) => p.id === id) },
    async addProject(p) { db.projects.push(p); save() },
    async saveProject(p) { const i = db.projects.findIndex((x) => x.id === p.id); if (i >= 0) db.projects[i] = p; save() },
    async removeProject(id) { db.projects = db.projects.filter((p) => p.id !== id); save() },
    async saveUpload(id, _mime, data) { ensureDirs(); await writeFileP(join(UPLOADS_DIR, id), data) },
    async getUpload(id) {
      const path = join(UPLOADS_DIR, id)
      if (!existsSync(path)) return undefined
      return { mime: mimeFromName(id), data: await readFileP(path) }
    },
    async recordSnapshot(projectId, pct) {
      db.snapshots ??= {}
      const day = new Date().toISOString().slice(0, 10)
      const arr = (db.snapshots[projectId] ??= [])
      const existing = arr.find((s) => s.day === day)
      if (existing) existing.pct = pct
      else arr.push({ day, pct })
      save()
    },
    async getHistory(projectId) { return (db.snapshots?.[projectId] ?? []).slice().sort((a, b) => a.day.localeCompare(b.day)) },
  }
}

// ============================ PostgreSQL backend =============================

async function pgStore(url: string): Promise<Store> {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
  })
  const q = (text: string, params?: unknown[]) => pool.query(text, params)

  const rowToProject = (r: any): Project => ({
    id: r.id, name: r.name, address: r.address, ownerId: r.owner_id,
    members: r.members ?? {}, building: r.building,
    createdAt: r.created_at, updatedAt: r.updated_at,
  })

  return {
    async init() {
      await q(`CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL,
        password_hash text NOT NULL, created_at text NOT NULL)`)
      await q(`CREATE TABLE IF NOT EXISTS projects (
        id text PRIMARY KEY, name text NOT NULL, address text NOT NULL DEFAULT '',
        owner_id text NOT NULL, members jsonb NOT NULL DEFAULT '{}'::jsonb,
        building jsonb NOT NULL, created_at text NOT NULL, updated_at text NOT NULL)`)
      await q(`CREATE TABLE IF NOT EXISTS uploads (
        id text PRIMARY KEY, mime text NOT NULL, data bytea NOT NULL, created_at timestamptz DEFAULT now())`)
      await q(`CREATE TABLE IF NOT EXISTS progress_snapshots (
        project_id text NOT NULL, day date NOT NULL, pct int NOT NULL,
        PRIMARY KEY (project_id, day))`)
      console.log('Store: PostgreSQL')
    },
    async findUserByEmail(email) {
      const { rows } = await q('SELECT * FROM users WHERE lower(email)=lower($1)', [email])
      return rows[0] && { id: rows[0].id, email: rows[0].email, name: rows[0].name, passwordHash: rows[0].password_hash, createdAt: rows[0].created_at }
    },
    async findUserById(id) {
      const { rows } = await q('SELECT * FROM users WHERE id=$1', [id])
      return rows[0] && { id: rows[0].id, email: rows[0].email, name: rows[0].name, passwordHash: rows[0].password_hash, createdAt: rows[0].created_at }
    },
    async addUser(u) {
      await q('INSERT INTO users (id,email,name,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
        [u.id, u.email, u.name, u.passwordHash, u.createdAt])
    },
    async listProjectsForUser(userId) {
      // `members ->> $1 IS NOT NULL` = user is a member (avoids the jsonb `?` operator).
      const { rows } = await q('SELECT * FROM projects WHERE owner_id=$1 OR members ->> $1 IS NOT NULL', [userId])
      return rows.map(rowToProject)
    },
    async findProject(id) {
      const { rows } = await q('SELECT * FROM projects WHERE id=$1', [id])
      return rows[0] ? rowToProject(rows[0]) : undefined
    },
    async addProject(p) {
      await q('INSERT INTO projects (id,name,address,owner_id,members,building,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [p.id, p.name, p.address, p.ownerId, JSON.stringify(p.members), JSON.stringify(p.building), p.createdAt, p.updatedAt])
    },
    async saveProject(p) {
      await q('UPDATE projects SET name=$2,address=$3,members=$4,building=$5,updated_at=$6 WHERE id=$1',
        [p.id, p.name, p.address, JSON.stringify(p.members), JSON.stringify(p.building), p.updatedAt])
    },
    async removeProject(id) { await q('DELETE FROM projects WHERE id=$1', [id]) },
    async saveUpload(id, mime, data) {
      await q('INSERT INTO uploads (id,mime,data) VALUES ($1,$2,$3)', [id, mime, data])
    },
    async getUpload(id) {
      const { rows } = await q('SELECT mime,data FROM uploads WHERE id=$1', [id])
      return rows[0] ? { mime: rows[0].mime, data: rows[0].data as Buffer } : undefined
    },
    async recordSnapshot(projectId, pct) {
      await q(`INSERT INTO progress_snapshots (project_id, day, pct) VALUES ($1, CURRENT_DATE, $2)
               ON CONFLICT (project_id, day) DO UPDATE SET pct = EXCLUDED.pct`, [projectId, Math.round(pct)])
    },
    async getHistory(projectId) {
      const { rows } = await q(`SELECT to_char(day,'YYYY-MM-DD') AS day, pct FROM progress_snapshots
                                WHERE project_id=$1 ORDER BY day`, [projectId])
      return rows.map((r: any) => ({ day: r.day, pct: r.pct }))
    },
  }
}

// ---- Select + initialise the backend ----------------------------------------

export const storeKind: 'postgres' | 'json' = process.env.DATABASE_URL ? 'postgres' : 'json'
export const store: Store = storeKind === 'postgres' ? await pgStore(process.env.DATABASE_URL!) : jsonStore()
await store.init()
