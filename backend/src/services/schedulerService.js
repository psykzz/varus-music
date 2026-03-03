import cron from 'node-cron'
import prisma from '../db.js'
import { generatePlaylist } from './playlistService.js'
import { enqueueDownload, searchAudio } from './downloadService.js'
import { fetchTopTracks, fetchSimilarTracks, fetchArtistTopTracks } from './lastfmService.js'

// Maximum new Last.fm tracks to seed per rotation (they download in the background)
const MAX_SEED_TRACKS = 20

/**
 * Returns the next run date based on the interval.
 */
export function getNextRunDate(interval) {
  const now = new Date()
  switch (interval) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    case 'weekly':
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  }
}

/**
 * Performs a full cadence rotation for a single user:
 *   1. Deactivates all current active playlist cycles
 *   2. Generates a new playlist (preserving the currently playing track if provided)
 *   3. Resets lastRun / nextRun on their CadenceSetting
 *
 * This is the same work the cron scheduler does, extracted so it can also be
 * triggered on-demand via the API.
 *
 * @param {string} userId
 * @param {{ currentTrackId?: string }} [opts]
 */
export async function rotatePlaylistForUser(userId, { currentTrackId } = {}) {
  const now = new Date()

  await prisma.playlistCycle.updateMany({
    where: { active: true, userId },
    data: { active: false },
  })

  const preserveTrackIds = currentTrackId ? [currentTrackId] : []
  const cycle = await generatePlaylist(userId, { preserveTrackIds })

  // Ensure a CadenceSetting exists (creates one with defaults if missing)
  const setting = await prisma.cadenceSetting.upsert({
    where: { userId },
    create: { userId, interval: 'weekly', lastRun: now, nextRun: getNextRunDate('weekly') },
    update: { lastRun: now, nextRun: getNextRunDate((await prisma.cadenceSetting.findUnique({ where: { userId }, select: { interval: true } }))?.interval ?? 'weekly') },
  })

  // Seed new tracks from Last.fm in the background — they auto-join the active
  // playlist through the addTrackToActivePlaylist hook in downloadService.
  seedFromLastfm(userId).catch((err) => {
    console.error('[Scheduler] seedFromLastfm error:', err)
  })

  return { cycle, nextRun: setting.nextRun }
}

/**
 * Fetch track candidates from the Last.fm catalog, filter out tracks already in
 * the database, then enqueue yt-dlp downloads for the new ones.
 *
 * Strategy:
 *  - Discovery users (few ratings): pull from the global chart.
 *  - Personalised users:            pull similar tracks for top liked artists
 *                                   and supplement with global chart.
 *
 * Each successful download is automatically appended to the user's active playlist
 * via addTrackToActivePlaylist() inside downloadService.
 *
 * @param {string} userId
 */
async function seedFromLastfm(userId) {
  // ── 1. Determine the user's liked artists (for personalised seeding) ─────
  const likedRatings = await prisma.rating.findMany({
    where: { userId, value: { gt: 0 } },
    include: { track: { select: { title: true, artist: true } } },
    orderBy: { value: 'desc' },
  })

  const candidates = []

  if (likedRatings.length >= 5) {
    // Personalised: get top tracks similar to the user's top liked artists
    // Deduplicate artists and take up to 3
    const seenArtists = new Set()
    const topArtists = []
    for (const r of likedRatings) {
      const artist = r.track.artist
      if (!seenArtists.has(artist)) {
        seenArtists.add(artist)
        topArtists.push({ title: r.track.title, artist })
      }
      if (topArtists.length >= 3) break
    }

    const similarResults = await Promise.all(
      topArtists.map(({ title, artist }) => fetchSimilarTracks(title, artist, 15))
    )
    for (const tracks of similarResults) candidates.push(...tracks)

    // Also fetch top tracks by those artists for extra variety
    const artistTopResults = await Promise.all(
      topArtists.map(({ artist }) => fetchArtistTopTracks(artist, 5))
    )
    for (const tracks of artistTopResults) candidates.push(...tracks)
  }

  // Always supplement with global chart tracks for discovery
  const chartTracks = await fetchTopTracks(30)
  candidates.push(...chartTracks)

  if (candidates.length === 0) {
    console.log('[Scheduler] seedFromLastfm: no Last.fm candidates returned (API key set?)')
    return
  }

  // ── 2. Filter out tracks already in the database ──────────────────────────
  // Build a set of "artist|title" (lower-cased) already in the DB
  const existingTracks = await prisma.track.findMany({ select: { title: true, artist: true } })
  const existingKeys = new Set(
    existingTracks.map((t) => `${t.artist.toLowerCase()}|${t.title.toLowerCase()}`)
  )

  // Also filter out any already-queued pending/downloading jobs to avoid duplicates
  const pendingJobs = await prisma.downloadJob.findMany({
    where: { userId, status: { in: ['pending', 'downloading'] } },
    select: { title: true, artist: true },
  })
  for (const j of pendingJobs) {
    if (j.title && j.artist) {
      existingKeys.add(`${j.artist.toLowerCase()}|${j.title.toLowerCase()}`)
    }
  }

  // Deduplicate candidates themselves
  const seen = new Set()
  const newCandidates = candidates.filter(({ title, artist }) => {
    if (!title || !artist) return false
    const key = `${artist.toLowerCase()}|${title.toLowerCase()}`
    if (existingKeys.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (newCandidates.length === 0) {
    console.log('[Scheduler] seedFromLastfm: all Last.fm candidates already in library.')
    return
  }

  const toSeed = newCandidates.slice(0, MAX_SEED_TRACKS)
  console.log(`[Scheduler] seedFromLastfm: queuing ${toSeed.length} new tracks for download.`)

  // ── 3. Search YouTube for each candidate and enqueue download ─────────────
  for (const { title, artist } of toSeed) {
    try {
      const query = `${artist} - ${title}`
      const results = await searchAudio(query, 1)
      if (!results.length) {
        console.warn(`[Scheduler] seedFromLastfm: no YouTube result for "${query}"`)
        continue
      }
      await enqueueDownload(results[0].url, userId, { title, artist })
    } catch (err) {
      console.warn(`[Scheduler] seedFromLastfm: failed to enqueue "${artist} - ${title}":`, err.message)
    }
  }
}

/**
 * Starts the cron scheduler. Runs every hour to check if any user's refresh is due.
 */
export function startScheduler() {
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date()

      // Find all users whose cadence is due
      const dueSettings = await prisma.cadenceSetting.findMany({
        where: { nextRun: { lte: now } },
      })

      if (dueSettings.length === 0) return

      console.log(`[Scheduler] ${dueSettings.length} user(s) due for playlist refresh.`)

      for (const setting of dueSettings) {
        try {
          await rotatePlaylistForUser(setting.userId)
          console.log(`[Scheduler] Rotated playlist for user ${setting.userId}.`)
        } catch (err) {
          console.error(`[Scheduler] Error for user ${setting.userId}:`, err)
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err)
    }
  })

  console.log('[Scheduler] Started — checking hourly for cadence expiry.')
}
