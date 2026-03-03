import prisma from '../db.js'
import { enqueueDownload, searchAudio } from '../services/downloadService.js'

export async function downloadRoutes(fastify) {
  // Search for audio candidates via yt-dlp
  fastify.get('/search', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { q } = request.query
    if (!q) return reply.code(400).send({ error: 'q (search query) is required' })
    const results = await searchAudio(q)
    return results
  })

  // Enqueue a download
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { url, title, artist } = request.body ?? {}
    if (!url) return reply.code(400).send({ error: 'url is required' })

    const job = await enqueueDownload(url, request.user.sub, { title, artist })
    return reply.code(201).send(job)
  })

  // List current user's download queue
  fastify.get('/queue', { preHandler: [fastify.authenticate] }, async (request) => {
    return prisma.downloadJob.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })

  // Cancel / delete a job
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const job = await prisma.downloadJob.findUnique({ where: { id: request.params.id } })
    if (!job) return reply.code(404).send({ error: 'Job not found' })
    if (job.userId !== request.user.sub) return reply.code(403).send({ error: 'Forbidden' })

    await prisma.downloadJob.delete({ where: { id: job.id } })
    return reply.code(204).send()
  })
}
