import prisma from '../db.js'

const DEFAULT_PLAYLIST_SIZE = 20

/**
 * Generate a new playlist cycle.
 * Tracks are ranked by their cumulative rating score.
 * New/unrated tracks are given a slot to be discovered.
 */
export async function generatePlaylist() {
  // Fetch all tracks with their scores
  const tracks = await prisma.track.findMany({
    include: { ratings: true },
  })

  if (tracks.length === 0) {
    // Create empty cycle
    return prisma.playlistCycle.create({
      data: {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  }

  // Score each track
  const scored = tracks.map((t) => ({
    id: t.id,
    score: t.ratings.reduce((sum, r) => sum + r.value, 0),
    ratingCount: t.ratings.length,
  }))

  // Sort: unrated tracks first (for discovery), then by score descending
  scored.sort((a, b) => {
    if (a.ratingCount === 0 && b.ratingCount > 0) return -1
    if (b.ratingCount === 0 && a.ratingCount > 0) return 1
    return b.score - a.score
  })

  // Filter out heavily disliked tracks (score <= -3), but always include unrated tracks
  const eligible = scored.filter((t) => t.score > -3 || t.ratingCount === 0)

  const selected = eligible.slice(0, DEFAULT_PLAYLIST_SIZE)

  // Get cadence to determine expiry
  const cadence = await prisma.cadenceSetting.findFirst({ orderBy: { createdAt: 'desc' } })
  const interval = cadence?.interval ?? 'weekly'

  const cycle = await prisma.playlistCycle.create({
    data: {
      expiresAt: getExpiryDate(interval),
      tracks: {
        create: selected.map((t, i) => ({ trackId: t.id, position: i })),
      },
    },
  })

  return cycle
}

function getExpiryDate(interval) {
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
