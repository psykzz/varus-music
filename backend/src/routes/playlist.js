import prisma from '../db.js'
import { generatePlaylist, addTrackToActivePlaylist } from '../services/playlistService.js'
import { rotatePlaylistForUser } from '../services/schedulerService.js'

export async function playlistRoutes(fastify) {
  // Get current active playlist cycle for the authenticated user
  fastify.get('/current', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.sub

    let cycle = await prisma.playlistCycle.findFirst({
      where: { active: true, userId },
      include: {
        tracks: {
          include: { track: { include: { ratings: { where: { userId } } } } },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    })

    if (!cycle) {
      cycle = await generatePlaylist(userId)
      cycle = await prisma.playlistCycle.findUnique({
        where: { id: cycle.id },
        include: {
          tracks: {
            include: { track: { include: { ratings: { where: { userId } } } } },
            orderBy: { position: 'asc' },
          },
        },
      })
    }

    return {
      id: cycle.id,
      startedAt: cycle.startedAt,
      expiresAt: cycle.expiresAt,
      tracks: cycle.tracks.map((ct) => ({
        position: ct.position,
        ...ct.track,
        score: ct.track.ratings.reduce((sum, r) => sum + r.value, 0),
      })),
    }
  })

  // Manually trigger playlist refresh for the authenticated user
  fastify.post('/refresh', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.sub
    await prisma.playlistCycle.updateMany({ where: { active: true, userId }, data: { active: false } })
    const cycle = await generatePlaylist(userId)
    return reply.code(201).send({ message: 'Playlist refreshed', cycleId: cycle.id })
  })

  // Rotate the playlist exactly as the cadence scheduler would:
  // deactivates the current cycle, generates a fresh one, and resets nextRun.
  fastify.post('/rotate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.sub
    const { cycle, nextRun } = await rotatePlaylistForUser(userId)
    return reply.code(201).send({ message: 'Playlist rotated', cycleId: cycle.id, nextRun })
  })

  // Manually add a specific track to the current active playlist cycle
  fastify.post('/add-track', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.sub
    const { trackId } = request.body
    if (!trackId) return reply.code(400).send({ error: 'trackId is required' })
    await addTrackToActivePlaylist(userId, trackId)
    return reply.code(201).send({ message: 'Track added to playlist' })
  })
}
