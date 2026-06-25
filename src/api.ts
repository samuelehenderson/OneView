// Typed client for the OneView backend. The token is kept in localStorage and
// attached as a Bearer header on every request.

import type { Building } from './data/types'

const TOKEN_KEY = 'oneview.token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)

export interface User {
  id: string
  email: string
  name: string
}

export interface Member {
  id: string
  email: string
  name: string
  role: 'editor' | 'viewer'
}

export interface Project {
  id: string
  name: string
  address: string
  ownerId: string
  members: Record<string, 'editor' | 'viewer'>
  building: Building
  createdAt: string
  updatedAt: string
  myRole: 'owner' | 'editor' | 'viewer'
  // Present on the single-project GET (and member mutations):
  ownerEmail?: string
  ownerName?: string
  memberList?: Member[]
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const res = await fetch(`/api${path}`, { ...init, headers })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`)
  return data as T
}

export const api = {
  register: (email: string, name: string, password: string) =>
    req<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, name, password }) }),
  login: (email: string, password: string) =>
    req<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => req<{ user: User }>('/auth/me'),

  listProjects: () => req<{ projects: Project[] }>('/projects'),
  createProject: (name: string, address: string) =>
    req<{ project: Project }>('/projects', { method: 'POST', body: JSON.stringify({ name, address }) }),
  getProject: (id: string) => req<{ project: Project }>(`/projects/${id}`),
  getHistory: (id: string) => req<{ history: { day: string; pct: number }[] }>(`/projects/${id}/history`),
  saveProject: (id: string, patch: { building?: Building; name?: string; address?: string }) =>
    req<{ project: Project }>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteProject: (id: string) => req<{ ok: true }>(`/projects/${id}`, { method: 'DELETE' }),
  addMember: (id: string, email: string, role: 'editor' | 'viewer') =>
    req<{ project: Project }>(`/projects/${id}/members`, { method: 'POST', body: JSON.stringify({ email, role }) }),
  removeMember: (id: string, userId: string) =>
    req<{ project: Project }>(`/projects/${id}/members/${userId}`, { method: 'DELETE' }),

  async uploadImage(file: File): Promise<string> {
    const fd = new FormData()
    fd.append('image', file)
    const { url } = await req<{ url: string }>('/upload', { method: 'POST', body: fd })
    return url
  },
}

// ---- Route path helpers ------------------------------------------------------
export const paths = {
  project: (pid: string) => `/p/${pid}`, // dashboard / overview
  building: (pid: string) => `/p/${pid}/building`,
  schedule: (pid: string) => `/p/${pid}/schedule`,
  timeline: (pid: string) => `/p/${pid}/timeline`,
  report: (pid: string) => `/p/${pid}/report`,
  floor: (pid: string, fid: string) => `/p/${pid}/floor/${fid}`,
  area: (pid: string, fid: string, aid: string, scopeId?: string) =>
    `/p/${pid}/floor/${fid}/area/${aid}${scopeId ? `?scope=${scopeId}` : ''}`,
}
