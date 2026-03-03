import { getToken } from './auth.js'

const API_BASE = '/api'

function authHeaders(extra = {}) {
  const token = getToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function handleResponse(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export async function fetchCurrentPlaylist() {
  return handleResponse(await fetch(`${API_BASE}/playlist/current`, { headers: authHeaders() }))
}

export async function refreshPlaylist() {
  return handleResponse(
    await fetch(`${API_BASE}/playlist/refresh`, { method: 'POST', headers: authHeaders() })
  )
}

export async function rotatePlaylist() {
  return handleResponse(
    await fetch(`${API_BASE}/playlist/rotate`, { method: 'POST', headers: authHeaders() })
  )
}

export async function fetchTracks() {
  return handleResponse(await fetch(`${API_BASE}/tracks`))
}

export async function uploadTrack(formData) {
  return handleResponse(
    await fetch(`${API_BASE}/tracks/upload`, { method: 'POST', headers: authHeaders(), body: formData })
  )
}

export async function deleteTrack(id) {
  const res = await fetch(`${API_BASE}/tracks/${id}`, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
}

export async function rateTrack(trackId, value) {
  return handleResponse(
    await fetch(`${API_BASE}/ratings/${trackId}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ value }),
    })
  )
}

export async function completeTrack(trackId) {
  return handleResponse(
    await fetch(`${API_BASE}/tracks/${trackId}/complete`, {
      method: 'POST',
      headers: authHeaders(),
    })
  )
}

export async function fetchCadence() {
  return handleResponse(await fetch(`${API_BASE}/cadence`, { headers: authHeaders() }))
}

export async function updateCadence(interval) {
  return handleResponse(
    await fetch(`${API_BASE}/cadence`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ interval }),
    })
  )
}

// --- Download API ---

export async function searchDownload(query) {
  return handleResponse(
    await fetch(`${API_BASE}/download/search?q=${encodeURIComponent(query)}`, { headers: authHeaders() })
  )
}

export async function enqueueDownload(url, meta = {}) {
  return handleResponse(
    await fetch(`${API_BASE}/download`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ url, ...meta }),
    })
  )
}

export async function fetchDownloadQueue() {
  return handleResponse(await fetch(`${API_BASE}/download/queue`, { headers: authHeaders() }))
}

export async function deleteDownloadJob(id) {
  const res = await fetch(`${API_BASE}/download/${id}`, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
}

// --- Onboarding API ---

export async function fetchGenres() {
  return handleResponse(await fetch(`${API_BASE}/onboarding/genres`))
}

export async function seedForUser(genres = []) {
  return handleResponse(
    await fetch(`${API_BASE}/onboarding/seed`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ genres }),
    })
  )
}

