const API_BASE = '/api'

async function handleResponse(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export async function fetchCurrentPlaylist() {
  return handleResponse(await fetch(`${API_BASE}/playlist/current`))
}

export async function refreshPlaylist() {
  return handleResponse(
    await fetch(`${API_BASE}/playlist/refresh`, { method: 'POST' })
  )
}

export async function fetchTracks() {
  return handleResponse(await fetch(`${API_BASE}/tracks`))
}

export async function uploadTrack(formData) {
  return handleResponse(
    await fetch(`${API_BASE}/tracks/upload`, { method: 'POST', body: formData })
  )
}

export async function deleteTrack(id) {
  const res = await fetch(`${API_BASE}/tracks/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
}

export async function rateTrack(trackId, value) {
  return handleResponse(
    await fetch(`${API_BASE}/ratings/${trackId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
  )
}

export async function fetchCadence() {
  return handleResponse(await fetch(`${API_BASE}/cadence`))
}

export async function updateCadence(interval) {
  return handleResponse(
    await fetch(`${API_BASE}/cadence`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval }),
    })
  )
}
