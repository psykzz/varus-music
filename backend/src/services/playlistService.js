import prisma from '../db.js'

const DEFAULT_PLAYLIST_SIZE = 20
// Number of meaningful ratings before switching from discovery mode to personalised mode
const DISCOVERY_THRESHOLD = 5
// In discovery mode: how many slots go to globally popular vs random unrated
const DISCOVERY_POPULAR_SLOTS = 12
const DISCOVERY_RANDOM_SLOTS = DEFAULT_PLAYLIST_SIZE - DISCOVERY_POPULAR_SLOTS

/**
 * Generate a new playlist cycle for a specific user.
 *
 * New users (< DISCOVERY_THRESHOLD ratings) get a discovery playlist:
 *   - DISCOVERY_POPULAR_SLOTS tracks with the highest aggregate score across all users
 *   - DISCOVERY_RANDOM_SLOTS randomly selected unrated tracks
 *
 * Users with enough ratings get the personalised algorithm:
 *   - Unrated tracks first (discovery slots), then sorted by personal score
 *
 * @param {string} userId
 */
export async function generatePlaylist(userId) {
  // Fetch all tracks with this user's ratings
  const tracks = await prisma.track.findMany({
    include: { ratings: true },
  })

  if (tracks.length === 0) {
    return prisma.playlistCycle.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  }

  // Split ratings into user's own and global aggregate
  const withUserRatings = tracks.map((t) => {
    const userRatings = t.ratings.filter((r) => r.userId === userId)
    const globalScore = t.ratings.reduce((sum, r) => sum + r.value, 0)
    const userScore = userRatings.reduce((sum, r) => sum + r.value, 0)
    return {
      id: t.id,
      globalScore,
      userScore,
      userRatingCount: userRatings.length,
    }
  })

  const userTotalRatings = withUserRatings.reduce((sum, t) => sum + t.userRatingCount, 0)

  let selected

  if (userTotalRatings < DISCOVERY_THRESHOLD) {
    // ── Discovery mode ────────────────────────────────────────────────────────
    // Popular tracks: globally highest aggregate score, exclude actively disliked by user
    const popular = withUserRatings
      .filter((t) => t.userScore > -1)
      .sort((a, b) => b.globalScore - a.globalScore)
      .slice(0, DISCOVERY_POPULAR_SLOTS)

    const popularIds = new Set(popular.map((t) => t.id))

    // Random unrated tracks: user has never rated them
    const unrated = withUserRatings.filter((t) => t.userRatingCount === 0 && !popularIds.has(t.id))
    // Fisher-Yates shuffle
    for (let i = unrated.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unrated[i], unrated[j]] = [unrated[j], unrated[i]]
    }
    const randomUnrated = unrated.slice(0, DISCOVERY_RANDOM_SLOTS)

    selected = [...popular, ...randomUnrated]
  } else {
    // ── Personalised mode ─────────────────────────────────────────────────────
    const scored = withUserRatings.map((t) => ({
      id: t.id,
      score: t.userScore,
      ratingCount: t.userRatingCount,
    }))

    // Sort: unrated tracks first (for discovery), then by personal score descending
    scored.sort((a, b) => {
      if (a.ratingCount === 0 && b.ratingCount > 0) return -1
      if (b.ratingCount === 0 && a.ratingCount > 0) return 1
      return b.score - a.score
    })

    // Filter out heavily disliked tracks (score <= -3), but always include unrated tracks
    const eligible = scored.filter((t) => t.score > -3 || t.ratingCount === 0)
    selected = eligible.slice(0, DEFAULT_PLAYLIST_SIZE)
  }

  // Get this user's cadence to determine expiry
  const cadence = await prisma.cadenceSetting.findUnique({ where: { userId } })
  const interval = cadence?.interval ?? 'weekly'

  const cycle = await prisma.playlistCycle.create({
    data: {
      userId,
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

/**
 * Add a single track to the user's active PlaylistCycle.
 * If no active cycle exists, a new one is generated so the track is included.
 * The unique constraint [cycleId, trackId] silently prevents duplicates.
 *
 * @param {string} userId
 * @param {string} trackId
 */
export async function addTrackToActivePlaylist(userId, trackId) {
  const cycle = await prisma.playlistCycle.findFirst({
    where: { userId, active: true },
    include: { tracks: { select: { position: true } } },
    orderBy: { startedAt: 'desc' },
  })

  if (!cycle) {
    // No active cycle — generate a fresh one (the new track will be included
    // naturally because generatePlaylist picks from all tracks).
    await generatePlaylist(userId)
    return
  }

  const maxPosition = cycle.tracks.reduce((max, t) => Math.max(max, t.position), -1)

  await prisma.playlistCycleTrack.upsert({
    where: { cycleId_trackId: { cycleId: cycle.id, trackId } },
    update: {},
    create: { cycleId: cycle.id, trackId, position: maxPosition + 1 },
  })
}
