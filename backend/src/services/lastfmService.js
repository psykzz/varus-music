/**
 * Last.fm metadata enrichment service.
 * Uses the Last.fm API to look up track info, album art, genre, and year.
 *
 * Required env: LASTFM_API_KEY
 */

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/'
const API_KEY = process.env.LASTFM_API_KEY

// Simple rate limiter: ensures at least MIN_INTERVAL ms between requests
const MIN_INTERVAL = 1000
let lastRequestTime = 0

async function throttledFetch(url) {
  const now = Date.now()
  const wait = MIN_INTERVAL - (now - lastRequestTime)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestTime = Date.now()
  return fetch(url)
}

/**
 * Enrich a track with metadata from Last.fm.
 * Returns { albumArtUrl, genre, year, lastfmUrl } or an empty object on failure.
 *
 * @param {string} title
 * @param {string} artist
 */
export async function enrichTrack(title, artist) {
  if (!API_KEY) {
    console.warn('[LastFM] LASTFM_API_KEY not set — skipping enrichment')
    return {}
  }

  try {
    const params = new URLSearchParams({
      method: 'track.getInfo',
      api_key: API_KEY,
      artist,
      track: title,
      autocorrect: '1',
      format: 'json',
    })

    const res = await throttledFetch(`${LASTFM_BASE}?${params}`)
    if (!res.ok) {
      console.warn(`[LastFM] HTTP ${res.status} for "${title}" by "${artist}"`)
      return {}
    }

    const data = await res.json()
    const track = data?.track
    if (!track) return {}

    // Album art — try to get the largest image
    const images = track.album?.image ?? []
    const artEntry = [...images].reverse().find((i) => i['#text'])
    const albumArtUrl = artEntry?.['#text'] || null

    // Genre — first top tag
    const genre = track.toptags?.tag?.[0]?.name ?? null

    // Year — from album wiki published date or track wiki
    let year = null
    const wikiDate = track.album?.wiki?.published || track.wiki?.published
    if (wikiDate) {
      const match = wikiDate.match(/\b(19|20)\d{2}\b/)
      if (match) year = parseInt(match[0], 10)
    }

    const lastfmUrl = track.url ?? null

    return { albumArtUrl, genre, year, lastfmUrl }
  } catch (err) {
    console.warn('[LastFM] Enrichment failed:', err.message)
    return {}
  }
}

/**
 * Fetch globally popular tracks from the Last.fm chart.
 * Returns an array of { title, artist } objects.
 *
 * @param {number} [limit=50]
 * @param {number} [page=1]
 */
export async function fetchTopTracks(limit = 50, page = 1) {
  if (!API_KEY) {
    console.warn('[LastFM] LASTFM_API_KEY not set — skipping fetchTopTracks')
    return []
  }

  try {
    const params = new URLSearchParams({
      method: 'chart.getTopTracks',
      api_key: API_KEY,
      limit: String(limit),
      page: String(page),
      format: 'json',
    })

    const res = await throttledFetch(`${LASTFM_BASE}?${params}`)
    if (!res.ok) {
      console.warn(`[LastFM] HTTP ${res.status} for chart.getTopTracks`)
      return []
    }

    const data = await res.json()
    const tracks = data?.tracks?.track ?? []
    return tracks.map((t) => ({ title: t.name, artist: t.artist?.name ?? t.artist }))
  } catch (err) {
    console.warn('[LastFM] fetchTopTracks failed:', err.message)
    return []
  }
}

/**
 * Fetch tracks similar to a given track from Last.fm.
 * Returns an array of { title, artist } objects.
 *
 * @param {string} title
 * @param {string} artist
 * @param {number} [limit=20]
 */
export async function fetchSimilarTracks(title, artist, limit = 20) {
  if (!API_KEY) {
    console.warn('[LastFM] LASTFM_API_KEY not set — skipping fetchSimilarTracks')
    return []
  }

  try {
    const params = new URLSearchParams({
      method: 'track.getSimilar',
      api_key: API_KEY,
      artist,
      track: title,
      autocorrect: '1',
      limit: String(limit),
      format: 'json',
    })

    const res = await throttledFetch(`${LASTFM_BASE}?${params}`)
    if (!res.ok) {
      console.warn(`[LastFM] HTTP ${res.status} for track.getSimilar`)
      return []
    }

    const data = await res.json()
    const tracks = data?.similartracks?.track ?? []
    return tracks.map((t) => ({ title: t.name, artist: t.artist?.name ?? t.artist }))
  } catch (err) {
    console.warn('[LastFM] fetchSimilarTracks failed:', err.message)
    return []
  }
}

/**
 * Fetch an artist's top tracks from Last.fm.
 * Returns an array of { title, artist } objects.
 *
 * @param {string} artist
 * @param {number} [limit=10]
 */
export async function fetchArtistTopTracks(artist, limit = 10) {
  if (!API_KEY) {
    console.warn('[LastFM] LASTFM_API_KEY not set — skipping fetchArtistTopTracks')
    return []
  }

  try {
    const params = new URLSearchParams({
      method: 'artist.getTopTracks',
      api_key: API_KEY,
      artist,
      autocorrect: '1',
      limit: String(limit),
      format: 'json',
    })

    const res = await throttledFetch(`${LASTFM_BASE}?${params}`)
    if (!res.ok) {
      console.warn(`[LastFM] HTTP ${res.status} for artist.getTopTracks`)
      return []
    }

    const data = await res.json()
    const tracks = data?.toptracks?.track ?? []
    return tracks.map((t) => ({ title: t.name, artist: t.artist?.name ?? artist }))
  } catch (err) {
    console.warn('[LastFM] fetchArtistTopTracks failed:', err.message)
    return []
  }
}
