import prisma from '../db.js'
import { generatePlaylist } from '../services/playlistService.js'

export async function playlistRoutes(fastify) {
  // Get current active playlist cycle
  fastify.get('/current', async (request, reply) => {
    let cycle = await prisma.playlistCycle.findFirst({
      where: { active: true },
      include: {
        tracks: {
          include: { track: { include: { ratings: true } } },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    })

    if (!cycle) {
      cycle = await generatePlaylist()
      cycle = await prisma.playlistCycle.findUnique({
        where: { id: cycle.id },
        include: {
          tracks: {
            include: { track: { include: { ratings: true } } },
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

  // Manually trigger playlist refresh
  fastify.post('/refresh', async (request, reply) => {
    // Deactivate current cycles
    await prisma.playlistCycle.updateMany({ where: { active: true }, data: { active: false } })
    const cycle = await generatePlaylist()
    return reply.code(201).send({ message: 'Playlist refreshed', cycleId: cycle.id })
  })
}
