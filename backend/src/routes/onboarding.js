import prisma from '../db.js'
import { SEED_GENRES, seedTracksForUser } from '../services/seedingService.js'

export async function onboardingRoutes(fastify) {
  // List available seed genres (public — needed before auth completes on first render)
  fastify.get('/genres', async () => ({ genres: SEED_GENRES }))

  // Seed tracks for the authenticated user and mark onboarding complete.
  // Body: { genres?: string[] }  — omit or send [] to use all defaults.
  fastify.post('/seed', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.sub

    // Prevent re-seeding if already completed (idempotent guard)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingComplete: true },
    })
    if (!user) return reply.code(404).send({ error: 'User not found' })
    if (user.onboardingComplete) return { queued: 0, alreadyComplete: true, genres: [] }

    const { genres } = request.body ?? {}
    const selectedGenres = Array.isArray(genres) && genres.length > 0
      ? genres.filter((g) => SEED_GENRES.includes(g))
      : SEED_GENRES

    const queued = await seedTracksForUser(userId, selectedGenres)

    // Mark onboarding complete regardless of how many tracks were queued
    // (could be 0 if library was already populated)
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingComplete: true },
    })

    return { queued, genres: selectedGenres }
  })
}
