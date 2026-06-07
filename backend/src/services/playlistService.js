import prisma from '../db.js'

const DEFAULT_PLAYLIST_SIZE = 100
// Maximum fraction of a cycle that liked tracks can occupy.
// When there are more liked tracks than this cap, the least-played ones are
// prioritised so every liked song gets airtime over successive cycles.
// The remaining slots are filled with neutral/unrated tracks to surface new music.
const LIKED_CAP_RATIO = 0.70

/**
 * Generate a new playlist cycle for a specific user.
 *
 * Algorithm:
 *  - Liked tracks (net score > 0, explicit or implicit): always protected from
 *    purge, and always given first-class treatment in the cycle.  When liked
 *    tracks exceed LIKED_CAP_RATIO × cycle size, the least-played ones are
 *    prioritised so favourites rotate through and every liked song gets heard.
 *  - Neutral / unrated tracks: fill the remaining slots (at least 30%) so new
 *    music is always promoted and has a chance to become liked.
 *  - Disliked tracks (score ≤ -3 for implicitly bad, any explicit dislike):
 *    excluded entirely.
 *
 * @param {string} userId
 * @param {{ preserveTrackIds?: string[] }} [opts]
 */
export async function generatePlaylist(userId, { preserveTrackIds = [] } = {}) {
  // Fetch all non-purged tracks with this user's ratings and play stats
  const tracks = await prisma.track.findMany({
    where: { filePurged: false },
    include: {
      ratings: { where: { userId } },
      trackStats: { where: { userId } },
    },
  })

  if (tracks.length === 0) {
    return prisma.playlistCycle.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  }

  const preserveSet = new Set(preserveTrackIds.map(String))

  const enriched = tracks.map((t) => {
    const userScore = t.ratings.reduce((sum, r) => sum + r.value, 0)
    const userPlayCount = t.trackStats[0]?.playCount ?? 0
    return { id: t.id, userScore, userPlayCount }
  })

  // Bucket 1: Liked — any net-positive score (explicit or implicit)
  const liked = enriched
    .filter((t) => t.userScore > 0)
    // Least-played first so every liked song gets airtime over successive cycles
    .sort((a, b) => a.userPlayCount - b.userPlayCount)

  // Bucket 2: Excluded — explicit dislike or heavily implicitly skipped
  const excludedIds = new Set(
    enriched.filter((t) => t.userScore <= -3 || t.userScore === -1).map((t) => t.id)
  )

  // Bucket 3: Neutral / unrated — everything else, randomly shuffled
  const neutral = enriched.filter((t) => t.userScore === 0 && !excludedIds.has(t.id))
  shuffle(neutral)

  // ── Fill the cycle ─────────────────────────────────────────────────────────
  // Liked tracks fill up to LIKED_CAP_RATIO of the cycle.  If there are fewer
  // liked tracks than that cap, all of them are included and neutral fills the rest.
  const maxLikedSlots = Math.floor(DEFAULT_PLAYLIST_SIZE * LIKED_CAP_RATIO)
  const likedSlice = liked.slice(0, maxLikedSlots)
  const neutralSlots = DEFAULT_PLAYLIST_SIZE - likedSlice.length
  const neutralSlice = neutral.slice(0, neutralSlots)

  let selected = [...likedSlice, ...neutralSlice]

  // Ensure preserved tracks (e.g. currently playing) are present
  if (preserveSet.size > 0) {
    const preserved = selected.filter((t) => preserveSet.has(String(t.id)))
    const rest = selected.filter((t) => !preserveSet.has(String(t.id)))
    selected = [...preserved, ...rest]
  }

  // Shuffle liked + neutral together so the queue isn't split into two
  // obvious halves, but keep preserved tracks at the front
  const preservedFront = selected.filter((t) => preserveSet.has(String(t.id)))
  const rest = selected.filter((t) => !preserveSet.has(String(t.id)))
  shuffle(rest)
  selected = [...preservedFront, ...rest]

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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
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
