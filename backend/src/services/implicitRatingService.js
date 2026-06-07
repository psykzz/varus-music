import prisma from '../db.js'

/**
 * Evaluates and upserts/deletes an implicit Rating for a user+track based on
 * their net play count (plays - skips).
 *
 * Rules:
 *   net >= 5  → implicit Like  (value: 1)
 *   net <= -5 → implicit Dislike (value: -1)
 *   otherwise → delete any existing implicit Rating
 *
 * Explicit Ratings always take precedence — if one exists, this function returns early.
 */
export async function evaluateImplicitRating(userId, trackId) {
  // Load stats
  const stats = await prisma.userTrackStats.findUnique({
    where: { userId_trackId: { userId, trackId } },
  })
  if (!stats) return

  const net = stats.playCount - stats.skipCount

  // Explicit rating takes precedence — don't touch it
  const explicit = await prisma.rating.findFirst({
    where: { userId, trackId, implicit: false },
  })
  if (explicit) return

  if (net >= 5) {
    await prisma.rating.upsert({
      where: { userId_trackId: { userId, trackId } },
      create: { userId, trackId, value: 1, implicit: true },
      update: { value: 1 },
    })
  } else if (net <= -5) {
    await prisma.rating.upsert({
      where: { userId_trackId: { userId, trackId } },
      create: { userId, trackId, value: -1, implicit: true },
      update: { value: -1 },
    })
  } else {
    // Net is in the neutral zone — remove any existing implicit rating
    await prisma.rating.deleteMany({
      where: { userId, trackId, implicit: true },
    })
  }
}
