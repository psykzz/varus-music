import prisma from '../db.js'

export async function ratingsRoutes(fastify) {
  // Rate a track (like=1, dislike=-1, neutral=0)
  fastify.post('/:trackId', async (request, reply) => {
    const { trackId } = request.params
    const { value } = request.body

    if (![1, 0, -1].includes(value)) {
      return reply.code(400).send({ error: 'value must be 1 (like), 0 (neutral), or -1 (dislike)' })
    }

    const track = await prisma.track.findUnique({ where: { id: trackId } })
    if (!track) return reply.code(404).send({ error: 'Track not found' })

    const rating = await prisma.rating.create({ data: { trackId, value } })
    return reply.code(201).send(rating)
  })

  // Get ratings for a track
  fastify.get('/:trackId', async (request, reply) => {
    const ratings = await prisma.rating.findMany({
      where: { trackId: request.params.trackId },
      orderBy: { createdAt: 'desc' },
    })
    const score = ratings.reduce((sum, r) => sum + r.value, 0)
    return { trackId: request.params.trackId, score, count: ratings.length, ratings }
  })
}
