import express, { type Request, type Response, type RequestHandler } from 'express'
import cors from 'cors'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { store, storeKind, canRead, canWrite, type Project, type Role } from './db.js'
import { hashPassword, requireAuth, signToken, verifyPassword, type AuthedRequest } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Port precedence: explicit --port arg (dev script) → host PORT (deployed) → 8787.
const argi = process.argv.indexOf('--port')
const PORT = (argi >= 0 && Number(process.argv[argi + 1])) || Number(process.env.PORT) || 8787
const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// Wrap async handlers so a rejected promise returns a JSON 500 instead of hanging.
const ah = (fn: (req: AuthedRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => fn(req as AuthedRequest, res).catch((e) => {
    console.error(e)
    if (!res.headersSent) res.status(500).json({ error: 'Server error' })
    else next(e)
  })

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

// Overall % complete of a building (average of every scope's progress) — for snapshots.
function buildingPct(building: any): number {
  const ps: number[] = []
  for (const f of building?.floors ?? [])
    for (const a of f.areas ?? [])
      for (const s of a.scopes ?? []) ps.push(Number(s.progress) || 0)
  return ps.length ? Math.round(ps.reduce((x, y) => x + y, 0) / ps.length) : 0
}

// Strip server-only fields and add the caller's role for the client.
function projectForClient(p: Project, userId: string) {
  return {
    id: p.id, name: p.name, address: p.address, ownerId: p.ownerId,
    members: p.members, building: p.building, createdAt: p.createdAt, updatedAt: p.updatedAt,
    myRole: p.ownerId === userId ? 'owner' : p.members[userId],
  }
}

// ---- Health check (used by Render) ------------------------------------------

app.get('/api/health', (_req: Request, res: Response) => res.json({ ok: true, store: storeKind }))

// ---- Auth routes ------------------------------------------------------------

app.post('/api/auth/register', ah(async (req, res) => {
  const { email, name, password } = req.body ?? {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  if (await store.findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists.' })
  const user = {
    id: 'u-' + randomUUID(),
    email: String(email),
    name: String(name || email).trim(),
    passwordHash: await hashPassword(String(password)),
    createdAt: new Date().toISOString(),
  }
  await store.addUser(user)
  res.json({ token: signToken(user.id), user: publicUser(user) })
}))

app.post('/api/auth/login', ah(async (req, res) => {
  const { email, password } = req.body ?? {}
  const user = email ? await store.findUserByEmail(String(email)) : undefined
  if (!user || !(await verifyPassword(String(password ?? ''), user.passwordHash)))
    return res.status(401).json({ error: 'Invalid email or password.' })
  res.json({ token: signToken(user.id), user: publicUser(user) })
}))

app.get('/api/auth/me', requireAuth, ah(async (req, res) => {
  const user = (await store.findUserById(req.userId!))!
  res.json({ user: publicUser(user) })
}))

// ---- Project routes ---------------------------------------------------------

app.get('/api/projects', requireAuth, ah(async (req, res) => {
  const list = await store.listProjectsForUser(req.userId!)
  const projects = list.map((p) => projectForClient(p, req.userId!)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  res.json({ projects })
}))

app.post('/api/projects', requireAuth, ah(async (req, res) => {
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
  await store.addProject(project)
  res.json({ project: projectForClient(project, req.userId!) })
}))

// Resolve member userIds → {email,name,role} (+ owner) for the share UI.
async function withMembers(p: Project, userId: string) {
  const owner = await store.findUserById(p.ownerId)
  const memberList = await Promise.all(
    Object.entries(p.members).map(async ([id, role]) => {
      const u = await store.findUserById(id)
      return { id, email: u?.email ?? id, name: u?.name ?? '', role }
    }),
  )
  return { ...projectForClient(p, userId), ownerEmail: owner?.email ?? '', ownerName: owner?.name ?? '', memberList }
}

app.get('/api/projects/:id', requireAuth, ah(async (req, res) => {
  const p = await store.findProject(req.params.id)
  if (!p || !canRead(p, req.userId!)) return res.status(404).json({ error: 'Project not found.' })
  res.json({ project: await withMembers(p, req.userId!) })
}))

// Save the building (and optionally name/address) for a project.
app.put('/api/projects/:id', requireAuth, ah(async (req, res) => {
  const p = await store.findProject(req.params.id)
  if (!p || !canRead(p, req.userId!)) return res.status(404).json({ error: 'Project not found.' })
  if (!canWrite(p, req.userId!)) return res.status(403).json({ error: 'You have view-only access.' })
  const { building, name, address } = req.body ?? {}
  if (building !== undefined) p.building = building
  if (name !== undefined) p.name = String(name)
  if (address !== undefined) p.address = String(address)
  p.updatedAt = new Date().toISOString()
  await store.saveProject(p)
  if (building !== undefined) await store.recordSnapshot(p.id, buildingPct(p.building)).catch(() => {})
  res.json({ project: projectForClient(p, req.userId!) })
}))

// Progress history (S-curve) for a project.
app.get('/api/projects/:id/history', requireAuth, ah(async (req, res) => {
  const p = await store.findProject(req.params.id)
  if (!p || !canRead(p, req.userId!)) return res.status(404).json({ error: 'Project not found.' })
  res.json({ history: await store.getHistory(p.id) })
}))

app.delete('/api/projects/:id', requireAuth, ah(async (req, res) => {
  const p = await store.findProject(req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found.' })
  if (p.ownerId !== req.userId!) return res.status(403).json({ error: 'Only the owner can delete a project.' })
  await store.removeProject(p.id)
  res.json({ ok: true })
}))

// Share a project with another user by email (owner only).
app.post('/api/projects/:id/members', requireAuth, ah(async (req, res) => {
  const p = await store.findProject(req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found.' })
  if (p.ownerId !== req.userId!) return res.status(403).json({ error: 'Only the owner can share a project.' })
  const { email, role } = req.body ?? {}
  const target = email ? await store.findUserByEmail(String(email)) : undefined
  if (!target) return res.status(404).json({ error: 'No user with that email. They must register first.' })
  if (target.id === p.ownerId) return res.status(400).json({ error: 'That user is the owner.' })
  p.members[target.id] = (role === 'viewer' ? 'viewer' : 'editor') as Role
  await store.saveProject(p)
  res.json({ project: await withMembers(p, req.userId!) })
}))

// Remove a member (owner only).
app.delete('/api/projects/:id/members/:userId', requireAuth, ah(async (req, res) => {
  const p = await store.findProject(req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found.' })
  if (p.ownerId !== req.userId!) return res.status(403).json({ error: 'Only the owner can manage members.' })
  delete p.members[req.params.userId]
  await store.saveProject(p)
  res.json({ project: await withMembers(p, req.userId!) })
}))

// ---- Floor-plan image upload (stored via the active backend) ----------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
})

app.post('/api/upload', requireAuth, upload.single('image'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded (must be an image file ≤ 15MB).' })
  const id = randomUUID() + (extname(req.file.originalname).toLowerCase() || '.png')
  await store.saveUpload(id, req.file.mimetype, req.file.buffer)
  res.json({ url: `/uploads/${id}` })
}))

app.get('/uploads/:id', ah(async (req, res) => {
  const u = await store.getUpload(req.params.id)
  if (!u) return res.status(404).end()
  res.set('Content-Type', u.mime)
  res.set('Cache-Control', 'public, max-age=31536000, immutable')
  res.send(u.data)
}))

// ---- Static: serve the GhostMap app (the product) ---------------------------
// GhostMap is a self-contained static app; the API above is its system-of-record.

const ghostmap = join(__dirname, '..', '..', 'ghostmap')
const dist = join(__dirname, '..', '..', 'dist')
const appDir = existsSync(ghostmap) ? ghostmap : (existsSync(dist) ? dist : null)
if (appDir) {
  app.use(express.static(appDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    res.sendFile(join(appDir, 'index.html'))
  })
}

app.listen(PORT, () => console.log(`GhostMap API + app listening on http://localhost:${PORT}`))
