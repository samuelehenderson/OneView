// Simple JSON-file data store. Adequate for low-traffic use and 100% portable
// (no native modules). The accessor surface below is the seam to swap in Postgres later.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// DATA_DIR can be overridden via env so it points at a persistent disk in production
// (e.g. Render mounts a disk at /data → set DATA_DIR=/data). Defaults to server/data in dev.
export const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data')
export const UPLOADS_DIR = join(DATA_DIR, 'uploads')
const DB_FILE = join(DATA_DIR, 'db.json')

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
  /** userId → role. Owner is implicitly an editor. */
  members: Record<string, Role>
  /** The full OneView building (floors → areas → scopes). */
  building: unknown
  createdAt: string
  updatedAt: string
}

interface DbShape {
  users: User[]
  projects: Project[]
}

function ensureDirs() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true })
}

function load(): DbShape {
  ensureDirs()
  if (!existsSync(DB_FILE)) return { users: [], projects: [] }
  try {
    const obj = JSON.parse(readFileSync(DB_FILE, 'utf8'))
    return { users: obj.users ?? [], projects: obj.projects ?? [] }
  } catch {
    return { users: [], projects: [] }
  }
}

let db: DbShape = load()

function save() {
  ensureDirs()
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

// ---- Users ----
export const findUserByEmail = (email: string) =>
  db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())
export const findUserById = (id: string) => db.users.find((u) => u.id === id)
export function addUser(u: User) {
  db.users.push(u)
  save()
}

// ---- Projects ----
export const listProjectsForUser = (userId: string) =>
  db.projects.filter((p) => p.ownerId === userId || userId in p.members)
export const findProject = (id: string) => db.projects.find((p) => p.id === id)
export function addProject(p: Project) {
  db.projects.push(p)
  save()
}
export function saveProject(p: Project) {
  const i = db.projects.findIndex((x) => x.id === p.id)
  if (i >= 0) db.projects[i] = p
  save()
}
export function removeProject(id: string) {
  db.projects = db.projects.filter((p) => p.id !== id)
  save()
}

/** Can this user see the project at all? */
export function canRead(p: Project, userId: string) {
  return p.ownerId === userId || userId in p.members
}
/** Can this user edit (owner or member with editor role)? */
export function canWrite(p: Project, userId: string) {
  return p.ownerId === userId || p.members[userId] === 'editor'
}
