const TOKEN_KEY = 'varus_token'
const USER_KEY = 'varus_user'

const API_BASE = '/api/auth'

async function handleResponse(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return !!getToken()
}

function storeSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function patchUser(updates) {
  const current = getUser()
  if (!current) return
  localStorage.setItem(USER_KEY, JSON.stringify({ ...current, ...updates }))
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function login(username, password) {
  const data = await handleResponse(
    await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  )
  storeSession(data)
  return data
}

export async function register(username, password) {
  const data = await handleResponse(
    await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  )
  storeSession(data)
  return data
}
