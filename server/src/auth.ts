import type { NextFunction, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { store } from './db.js'

// In production set JWT_SECRET in the environment. The fallback keeps dev frictionless.
const SECRET = process.env.JWT_SECRET || 'oneview-dev-secret-change-me'
const TOKEN_TTL = '30d'

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10)
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)

export const signToken = (userId: string) => jwt.sign({ sub: userId }, SECRET, { expiresIn: TOKEN_TTL })

export interface AuthedRequest extends Request {
  userId?: string
}

/** Express middleware: require a valid Bearer token; attaches req.userId. */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const payload = jwt.verify(token, SECRET) as { sub: string }
    if (!(await store.findUserById(payload.sub))) return res.status(401).json({ error: 'Unknown user' })
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
