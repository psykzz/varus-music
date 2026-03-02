import prisma from '../db.js'
import { getNextRunDate } from '../services/schedulerService.js'

export async function cadenceRoutes(fastify) {
  // Get current cadence setting
  fastify.get('/', async () => {
    let setting = await prisma.cadenceSetting.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!setting) {
      setting = await prisma.cadenceSetting.create({
        data: { interval: 'weekly', nextRun: getNextRunDate('weekly') },
      })
    }
    return setting
  })

  // Update cadence interval
  fastify.put('/', async (request, reply) => {
    const { interval } = request.body
    if (!['daily', 'weekly', 'monthly'].includes(interval)) {
      return reply.code(400).send({ error: 'interval must be daily, weekly, or monthly' })
    }
    let setting = await prisma.cadenceSetting.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!setting) {
      setting = await prisma.cadenceSetting.create({
        data: { interval, nextRun: getNextRunDate(interval) },
      })
    } else {
      setting = await prisma.cadenceSetting.update({
        where: { id: setting.id },
        data: { interval, nextRun: getNextRunDate(interval) },
      })
    }
    return setting
  })
}
