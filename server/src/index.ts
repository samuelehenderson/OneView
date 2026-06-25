import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addProject, addUser, canRead, canWrite, findProject, findUserByEmail, findUserById,
  listProjectsForUser, removeProject, saveProject, UPLOADS_DIR, type Project, type Role,
} from './db.js'
import { hashPassword, requireAuth, signToken, verifyPassword, type AuthedRequest } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Port precedence: explicit --port arg (used by the dev script) → host-provided PORT
// (used when deployed) → 8787. The arg wins in dev so an injected PORT can't collide
// with the Vite server; PORT is honoured in production where there's no arg.
const argi = process.argv.indexOf('--port')
const PORT = (argi >= 0 && Number(process.argv[argi + 1])) || Number(process.env.PORT) || 8787
const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// ---- Helpers ----------------------------------------------------------------

const publicUser = (u: { id: string; email: string; name: string }) => ({ id: u.id, email: u.email, name: u.name })

function newBuilding(name: string, address: string) {
  return {
    id: 'bldg-' + randomUUID().slice(0, 8),
    name,
    address,
    floors: [{ id: 'fl-' + randomUUID().slice(0, 8), name: 'Ground Floor', level: 0, areas: [] }],
  }
}

// Strip server-only fields and add the caller's role for the client.
function projectForClient(p: Project, userId: string) {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    ownerId: p.ownerId,
    members: p.members,
    building: p.building,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    myRole: p.ownerId === userId ? 'owner' : p.members[userId],
  }
}

// ---- Health check (used by Render) ------------------------------------------

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ---- Auth routes ------------------------------------------------------------

app.post('/api/auth/register', async (req, res) => {
  const { email, name, password } = req.body ?? {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  if (findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists.' })
  const user = {
    id: 'u-' + randomUUID(),
    email: String(email),
    name: String(name || email).trim(),
    passwordHash: await hashPassword(String(password)),
    createdAt: new Date().toISOString(),
  }
  addUser(user)
  res.json({ token: signToken(user.id), user: publicUser(user) })
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  const user = email && findUserByEmail(String(email))
  if (!user || !(await verifyPassword(String(password ?? ''), user.passwordHash)))
    return res.status(401).json({ error: 'Invalid email or password.' })
  res.json({ token: signToken(user.id), user: publicUser(user) })
})

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  const user = findUserById(req.userId!)!
  res.json({ user: publicUser(user) })
})

// ---- Project routes ---------------------------------------------------------

app.get('/api/projects', requireAuth, (req: AuthedRequest, res) => {
  const projects = listProjectsForUser(req.userId!)
    .map((p) => projectForClient(p, req.userId!))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  res.json({ projects })
})

app.post('/api/projects', requireAuth, (req: AuthedRequest, res) => {
  const { name, address } = req.body ?? {}
  if (!name) return res.status(400).json({ error: 'Project name is required.' })
  const now = new Date().toISOString()
  const project: Project = {
    id: 'p-' + randomUUID(),
    name: String(name),
    address: String(address || ''),
    ownerId: req.userId!,
    members: {},
    building: newBuilding(String(name), String(address || '')),
    createdAt: now,
    updatedAt: now,
  }
  addProject(project)
  res.json({ project: projectForClient(project, req.userId!) })
})

app.get('/api/projects/:id', requireAuth, (req: AuthedRequest, res) => {
  const p = findProject(req.params.id)
  if (!p || !canRead(p, req.userId!)) return res.status(404).json({ error: 'Project not found.' })
  res.json({ project: projectForClient(p, req.userId!) })
})

// Save the building (and optionally name/address) for a project.
app.put('/api/projects/:id', requireAuth, (req: AuthedRequest, res) => {
  const p = findProject(req.params.id)
  if (!p || !canRead(p, req.userId!)) return res.status(404).json({ error: 'Project not found.' })
  if (!canWrite(p, req.userId!)) return res.status(403).json({ error: 'You have view-only access.' })
  const { building, name, address } = req.body ?? {}
  if (building !== undefined) p.building = building
  if (name !== undefined) p.name = String(name)
  if (address !== undefined) p.address = String(address)
  p.updatedAt = new Date().toISOString()
  saveProject(p)
  res.json({ project: projectForClient(p, req.userId!) })
})

app.delete('/api/projects/:id', requireAuth, (req: AuthedRequest, res) => {
  const p = findProject(req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found.' })
  if (p.ownerId !== req.userId!) return res.status(403).json({ error: 'Only the owner can delete a project.' })
  removeProject(p.id)
  res.json({ ok: true })
})

// Share a project with another user by email (owner only).
app.post('/api/projects/:id/members', requireAuth, (req: AuthedRequest, res) => {
  const p = findProject(req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found.' })
  if (p.ownerId !== req.userId!) return res.status(403).json({ error: 'Only the owner can share a project.' })
  const { email, role } = req.body ?? {}
  const target = email && findUserByEmail(String(email))
  if (!target) return res.status(404).json({ error: 'No user with that email. They must register first.' })
  if (target.id === p.ownerId) return res.status(400).json({ error: 'That user is the owner.' })
  p.members[target.id] = (role === 'viewer' ? 'viewer' : 'editor') as Role
  saveProject(p)
  res.json({ project: projectForClient(p, req.userId!) })
})

// ---- Floor-plan image upload ------------------------------------------------

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, randomUUID() + extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
})

app.post('/api/upload', requireAuth, upload.single('image'), (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded (must be an image file ≤ 15MB).' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

// ---- Static: uploaded images + built frontend (production) ------------------

app.use('/uploads', express.static(UPLOADS_DIR))

const dist = join(__dirname, '..', '..', 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  // SPA fallback for client-side routes, but let unknown /api paths 404 as JSON.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(join(dist, 'index.html'))
  })
}

app.listen(PORT, () => console.log(`OneView API listening on http://localhost:${PORT}`))
