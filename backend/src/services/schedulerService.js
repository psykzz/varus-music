import cron from 'node-cron'
import prisma from '../db.js'
import { generatePlaylist } from './playlistService.js'

/**
 * Returns the next run date based on the interval.
 */
export function getNextRunDate(interval) {
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
 * Starts the cron scheduler. Runs every hour to check if a refresh is due.
 */
export function startScheduler() {
  cron.schedule('0 * * * *', async () => {
    try {
      const setting = await prisma.cadenceSetting.findFirst({ orderBy: { createdAt: 'desc' } })
      if (!setting) return

      const now = new Date()
      if (setting.nextRun && setting.nextRun <= now) {
        console.log('[Scheduler] Cadence expired — refreshing playlist...')

        // Deactivate old cycles
        await prisma.playlistCycle.updateMany({ where: { active: true }, data: { active: false } })

        // Generate new playlist
        await generatePlaylist()

        // Update last/next run
        await prisma.cadenceSetting.update({
          where: { id: setting.id },
          data: {
            lastRun: now,
            nextRun: getNextRunDate(setting.interval),
          },
        })

        console.log('[Scheduler] Playlist refreshed.')
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err)
    }
  })

  console.log('[Scheduler] Started — checking hourly for cadence expiry.')
}
