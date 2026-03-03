import prisma from '../db.js'
import { getNextRunDate } from '../services/schedulerService.js'

export async function cadenceRoutes(fastify) {
  // Get current user's cadence setting
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user.sub
    let setting = await prisma.cadenceSetting.findUnique({ where: { userId } })
    if (!setting) {
      setting = await prisma.cadenceSetting.create({
        data: { userId, interval: 'weekly', nextRun: getNextRunDate('weekly') },
      })
    }
    return setting
  })

  // Update cadence interval
  fastify.put('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { interval } = request.body
    const userId = request.user.sub
    if (!['daily', 'weekly', 'monthly'].includes(interval)) {
      return reply.code(400).send({ error: 'interval must be daily, weekly, or monthly' })
    }
    const setting = await prisma.cadenceSetting.upsert({
      where: { userId },
      create: { userId, interval, nextRun: getNextRunDate(interval) },
      update: { interval, nextRun: getNextRunDate(interval) },
    })
    return setting
  })
}
