import prisma from '../db.js'

const DISCOVERY_THRESHOLD = 5

export async function debugRoutes(fastify) {
  /**
   * GET /api/debug/playlist-info
   * Returns a breakdown of how the current user's playlist is generated:
   *  - algorithm metadata (mode, ratings needed, etc.)
   *  - allTracks sorted by global popularity (playCount + aggregate rating score)
   *  - ratedTracks (user has an explicit like/dislike) sorted most liked → least
   *  - unheardTracks (user has never rated the track)
   */
  fastify.get('/playlist-info', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user.sub

    const tracks = await prisma.track.findMany({
      include: { ratings: true },
      orderBy: { createdAt: 'desc' },
    })

    const enriched = tracks.map((t) => {
      const userRating = t.ratings.find((r) => r.userId === userId)
      const globalScore = t.ratings.reduce((sum, r) => sum + r.value, 0)
      return {
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album ?? null,
        albumArtUrl: t.albumArtUrl ?? null,
        genre: t.genre ?? null,
        year: t.year ?? null,
        playCount: t.playCount,
        globalScore,
        globalRatingCount: t.ratings.length,
        // Popularity composite: play completions carry more weight than raw vote scores
        popularityScore: t.playCount * 2 + globalScore,
        userScore: userRating ? userRating.value : null,
        isRated: userRating != null,
        isUnheard: userRating == null,
      }
    })

    const userTotalRatings = enriched.filter((t) => t.isRated).length

    // ── 1. All tracks sorted by global popularity ──────────────────────────
    const popularTracks = [...enriched].sort((a, b) => {
      if (b.popularityScore !== a.popularityScore) return b.popularityScore - a.popularityScore
      return b.playCount - a.playCount
    })

    // ── 2. Rated tracks — user has given a thumbs-up or thumbs-down ────────
    const ratedTracks = enriched
      .filter((t) => t.isRated)
      .sort((a, b) => b.userScore - a.userScore)

    // ── 3. Unheard — user has never rated these ────────────────────────────
    const unheardTracks = enriched.filter((t) => t.isUnheard)

    // ── Algorithm metadata ─────────────────────────────────────────────────
    const mode = userTotalRatings < DISCOVERY_THRESHOLD ? 'discovery' : 'personalized'
    const ratingsUntilPersonalized =
      mode === 'discovery' ? DISCOVERY_THRESHOLD - userTotalRatings : 0

    return {
      algorithm: {
        mode,
        userTotalRatings,
        discoveryThreshold: DISCOVERY_THRESHOLD,
        ratingsUntilPersonalized,
        description:
          mode === 'discovery'
            ? `Discovery mode — listening to ${DISCOVERY_THRESHOLD - userTotalRatings} more track(s) will unlock personalised playlists.`
            : 'Personalised mode — your playlist is shaped by your ratings, with new discoveries mixed in.',
      },
      summary: {
        totalTracks: enriched.length,
        ratedCount: ratedTracks.length,
        unheardCount: unheardTracks.length,
      },
      popularTracks,
      ratedTracks,
      unheardTracks,
    }
  })
}
