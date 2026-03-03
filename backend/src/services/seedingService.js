/**
 * Onboarding seeding service.
 * Fetches top tracks from Last.fm by genre tag and enqueues them as yt-dlp
 * download jobs so new users have something to listen to immediately.
 *
 * Required env: LASTFM_API_KEY (gracefully skips if absent)
 */

import prisma from '../db.js'
import { enqueueDownload } from './downloadService.js'

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/'
const API_KEY = process.env.LASTFM_API_KEY

// Rate-limit shared with lastfmService
const MIN_INTERVAL = 1100
let lastRequestTime = 0

async function throttledFetch(url) {
  const now = Date.now()
  const wait = MIN_INTERVAL - (now - lastRequestTime)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestTime = Date.now()
  return fetch(url)
}

export const SEED_GENRES = [
  'pop',
  'rock',
  'hip-hop',
  'electronic',
  'classical',
  'indie',
  'jazz',
  'r&b',
]

// How many tracks to fetch per genre on first seed
const TRACKS_PER_GENRE = 5

/**
 * Fetch top tracks for a given Last.fm genre tag.
 * Returns an array of { title, artist } objects.
 */
export async function getTopTracksForGenre(genre, limit = TRACKS_PER_GENRE) {
  if (!API_KEY) {
    console.warn('[Seeding] LASTFM_API_KEY not set — using fallback curated tracks')
    return getFallbackTracks(genre).slice(0, limit)
  }

  try {
    const params = new URLSearchParams({
      method: 'tag.getTopTracks',
      tag: genre,
      api_key: API_KEY,
      limit: String(limit),
      format: 'json',
    })

    const res = await throttledFetch(`${LASTFM_BASE}?${params}`)
    if (!res.ok) {
      console.warn(`[Seeding] Last.fm HTTP ${res.status} for genre "${genre}"`)
      return getFallbackTracks(genre).slice(0, limit)
    }

    const data = await res.json()
    const items = data?.tracks?.track ?? []
    return items.map((t) => ({
      title: t.name,
      artist: typeof t.artist === 'string' ? t.artist : t.artist?.name ?? 'Unknown Artist',
    }))
  } catch (err) {
    console.warn(`[Seeding] Failed to fetch tracks for genre "${genre}":`, err.message)
    return getFallbackTracks(genre).slice(0, limit)
  }
}

/**
 * Seed the library for a new user by fetching top tracks for the requested
 * genres and queuing yt-dlp download jobs.
 *
 * Tracks already present in the library (matched by artist + title,
 * case-insensitive) or already queued are skipped to avoid duplicates.
 *
 * @param {string} userId
 * @param {string[]} genres - genre tags to seed from (defaults to SEED_GENRES)
 * @returns {Promise<number>} number of new download jobs created
 */
export async function seedTracksForUser(userId, genres = SEED_GENRES) {
  const targetGenres = genres.length > 0 ? genres : SEED_GENRES

  // Collect all (artist + title) pairs currently in the library
  const existingTracks = await prisma.track.findMany({ select: { artist: true, title: true } })
  const existingKeys = new Set(
    existingTracks.map((t) => normaliseKey(t.artist, t.title))
  )

  // Also collect pending/downloading download jobs to avoid re-queuing
  const pendingJobs = await prisma.downloadJob.findMany({
    where: { status: { in: ['pending', 'downloading'] } },
    select: { artist: true, title: true },
  })
  for (const j of pendingJobs) {
    if (j.artist && j.title) existingKeys.add(normaliseKey(j.artist, j.title))
  }

  let queued = 0

  for (const genre of targetGenres) {
    const tracks = await getTopTracksForGenre(genre, TRACKS_PER_GENRE)

    for (const { title, artist } of tracks) {
      const key = normaliseKey(artist, title)
      if (existingKeys.has(key)) {
        console.log(`[Seeding] Skipping duplicate: ${artist} - ${title}`)
        continue
      }

      // Use ytsearch so yt-dlp finds the best match on YouTube
      const searchQuery = `ytsearch1:${artist} ${title} official audio`
      await enqueueDownload(searchQuery, userId, { title, artist })
      existingKeys.add(key) // prevent re-queuing within same seed run
      queued++
    }
  }

  console.log(`[Seeding] Queued ${queued} new tracks for user ${userId}`)
  return queued
}

function normaliseKey(artist, title) {
  return `${artist}|${title}`.toLowerCase().trim()
}

/**
 * Curated fallback tracks used when LASTFM_API_KEY is not configured.
 * Provides a reasonable starting selection without requiring API access.
 */
function getFallbackTracks(genre) {
  const fallbacks = {
    pop: [
      { artist: 'Dua Lipa', title: 'Levitating' },
      { artist: 'Harry Styles', title: 'As It Was' },
      { artist: 'The Weeknd', title: 'Blinding Lights' },
      { artist: 'Olivia Rodrigo', title: 'drivers license' },
      { artist: 'Ed Sheeran', title: 'Shape of You' },
    ],
    rock: [
      { artist: 'Foo Fighters', title: 'Everlong' },
      { artist: 'Arctic Monkeys', title: 'Do I Wanna Know?' },
      { artist: 'Nirvana', title: 'Smells Like Teen Spirit' },
      { artist: 'Queen', title: 'Bohemian Rhapsody' },
      { artist: 'Radiohead', title: 'Creep' },
    ],
    'hip-hop': [
      { artist: 'Kendrick Lamar', title: 'HUMBLE.' },
      { artist: 'Drake', title: 'God\'s Plan' },
      { artist: 'Kanye West', title: 'Gold Digger' },
      { artist: 'Eminem', title: 'Lose Yourself' },
      { artist: 'Jay-Z', title: 'HOVA Song' },
    ],
    electronic: [
      { artist: 'Daft Punk', title: 'Get Lucky' },
      { artist: 'Avicii', title: 'Wake Me Up' },
      { artist: 'Calvin Harris', title: 'Summer' },
      { artist: 'Disclosure', title: 'Latch' },
      { artist: 'Flume', title: 'Never Be Like You' },
    ],
    classical: [
      { artist: 'Ludwig van Beethoven', title: 'Moonlight Sonata' },
      { artist: 'Johann Sebastian Bach', title: 'Cello Suite No. 1' },
      { artist: 'Wolfgang Amadeus Mozart', title: 'Eine kleine Nachtmusik' },
      { artist: 'Frédéric Chopin', title: 'Nocturne Op. 9 No. 2' },
      { artist: 'Claude Debussy', title: 'Clair de Lune' },
    ],
    indie: [
      { artist: 'Tame Impala', title: 'The Less I Know The Better' },
      { artist: 'Mac DeMarco', title: 'Chamber of Reflection' },
      { artist: 'Bon Iver', title: 'Skinny Love' },
      { artist: 'Fleet Foxes', title: 'White Winter Hymnal' },
      { artist: 'Vampire Weekend', title: 'A-Punk' },
    ],
    jazz: [
      { artist: 'Miles Davis', title: 'So What' },
      { artist: 'John Coltrane', title: 'A Love Supreme' },
      { artist: 'Dave Brubeck', title: 'Take Five' },
      { artist: 'Chet Baker', title: 'Almost Blue' },
      { artist: 'Bill Evans', title: 'Waltz for Debby' },
    ],
    'r&b': [
      { artist: 'Beyoncé', title: 'Crazy in Love' },
      { artist: 'Frank Ocean', title: 'Thinkin Bout You' },
      { artist: 'SZA', title: 'Good Days' },
      { artist: 'H.E.R.', title: 'Focus' },
      { artist: 'Daniel Caesar', title: 'Get You' },
    ],
  }

  return fallbacks[genre] ?? []
}
