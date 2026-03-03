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
 * Performs a full cadence rotation for a single user:
 *   1. Deactivates all current active playlist cycles
 *   2. Generates a new playlist
 *   3. Resets lastRun / nextRun on their CadenceSetting
 *
 * This is the same work the cron scheduler does, extracted so it can also be
 * triggered on-demand via the API.
 *
 * @param {string} userId
 */
export async function rotatePlaylistForUser(userId) {
  const now = new Date()

  await prisma.playlistCycle.updateMany({
    where: { active: true, userId },
    data: { active: false },
  })

  const cycle = await generatePlaylist(userId)

  // Ensure a CadenceSetting exists (creates one with defaults if missing)
  const setting = await prisma.cadenceSetting.upsert({
    where: { userId },
    create: { userId, interval: 'weekly', lastRun: now, nextRun: getNextRunDate('weekly') },
    update: { lastRun: now, nextRun: getNextRunDate((await prisma.cadenceSetting.findUnique({ where: { userId }, select: { interval: true } }))?.interval ?? 'weekly') },
  })

  return { cycle, nextRun: setting.nextRun }
}

/**
 * Starts the cron scheduler. Runs every hour to check if any user's refresh is due.
 */
export function startScheduler() {
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date()

      // Find all users whose cadence is due
      const dueSettings = await prisma.cadenceSetting.findMany({
        where: { nextRun: { lte: now } },
      })

      if (dueSettings.length === 0) return

      console.log(`[Scheduler] ${dueSettings.length} user(s) due for playlist refresh.`)

      for (const setting of dueSettings) {
        try {
          await rotatePlaylistForUser(setting.userId)
          console.log(`[Scheduler] Rotated playlist for user ${setting.userId}.`)
        } catch (err) {
          console.error(`[Scheduler] Error for user ${setting.userId}:`, err)
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err)
    }
  })

  console.log('[Scheduler] Started — checking hourly for cadence expiry.')
}
