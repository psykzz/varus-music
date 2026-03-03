import prisma from '../db.js'

const DEFAULT_PLAYLIST_SIZE = 100
// Number of meaningful ratings before switching from discovery mode to personalised mode
const DISCOVERY_THRESHOLD = 5
// In discovery mode: how many slots go to globally popular vs random unrated (50/50)
const DISCOVERY_POPULAR_SLOTS = Math.floor(DEFAULT_PLAYLIST_SIZE * 0.5)
const DISCOVERY_RANDOM_SLOTS = DEFAULT_PLAYLIST_SIZE - DISCOVERY_POPULAR_SLOTS
// In personalised mode: cap on how many highly-rated (score > 0) tracks fill the cycle
const MAX_RATED_RATIO = 0.5

/**
 * Generate a new playlist cycle for a specific user.
 *
 * New users (< DISCOVERY_THRESHOLD ratings) get a discovery playlist:
 *   - DISCOVERY_POPULAR_SLOTS tracks with the highest aggregate score across all users
 *   - DISCOVERY_RANDOM_SLOTS randomly selected unrated tracks
 *
 * Users with enough ratings get the personalised algorithm:
 *   - Up to 50% from highly-rated (score > 0) tracks, shuffled from a 2× candidate pool
 *   - The rest filled with randomly shuffled unrated / neutral tracks
 *   If the user has fewer liked tracks than the cap, all of them are included and
 *   the remaining slots are filled with random tracks.
 *
 * @param {string} userId
 * @param {{ preserveTrackIds?: string[] }} [opts]
 */
export async function generatePlaylist(userId, { preserveTrackIds = [] } = {}) {
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

  // Normalise preserve list to strings for reliable comparison
  const preserveSet = new Set(preserveTrackIds.map(String))

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

    // "Highly rated" = net-positive score. These fill up to 50% of the cycle.
    const likedPool = scored.filter((t) => t.score > 0)
    // Random pool: unrated or rated but not heavily disliked (score between -3 and 0 inclusive)
    const randomPool = scored.filter((t) => t.score <= 0 && t.score > -3)

    // Determine actual liked slots — capped at MAX_RATED_RATIO of the target size
    const maxLikedSlots = Math.floor(DEFAULT_PLAYLIST_SIZE * MAX_RATED_RATIO)
    const likedSlotCount = Math.min(likedPool.length, maxLikedSlots)

    // Sort liked tracks by score descending, take a 2× candidate window, then shuffle
    // so each rotation surfaces a varied subset of the user's favourites.
    likedPool.sort((a, b) => b.score - a.score)
    const likedCandidates = likedPool.slice(0, likedSlotCount * 2)
    for (let i = likedCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [likedCandidates[i], likedCandidates[j]] = [likedCandidates[j], likedCandidates[i]]
    }
    const likedSelected = likedCandidates.slice(0, likedSlotCount)

    // Fill remaining slots with randomly shuffled pool tracks
    const randomSlotCount = DEFAULT_PLAYLIST_SIZE - likedSelected.length
    for (let i = randomPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [randomPool[i], randomPool[j]] = [randomPool[j], randomPool[i]]
    }
    const randomSelected = randomPool.slice(0, randomSlotCount)

    selected = [...likedSelected, ...randomSelected]
  }

  // Ensure preserved tracks are included (e.g. currently playing track).
  // Prepend them at position 0 and trim the tail to stay within the size limit.
  if (preserveSet.size > 0) {
    const preservedEntries = selected.filter((t) => preserveSet.has(String(t.id)))
    const rest = selected.filter((t) => !preserveSet.has(String(t.id)))
    selected = [...preservedEntries, ...rest].slice(0, DEFAULT_PLAYLIST_SIZE)
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
