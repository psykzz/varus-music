/**
 * Cleanup service.
 * Removes audio files from the filesystem for tracks that are not currently
 * in any active playlist cycle, while retaining the Track database record
 * (with filePurged=true) so the track can be re-downloaded on demand via
 * its stored sourceUrl.
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MUSIC_STORAGE_PATH =
  process.env.MUSIC_STORAGE_PATH || path.join(__dirname, '..', '..', 'storage', 'music')

/**
 * Delete audio files for tracks that are not referenced by any active
 * playlist cycle.  The Track row is kept with filePurged=true so it can be
 * restored later using its sourceUrl.
 *
 * @returns {Promise<{ purged: number }>}
 */
export async function purgeUnusedFiles() {
  // Collect track IDs that are part of at least one active playlist cycle
  const activeCycleTracks = await prisma.playlistCycleTrack.findMany({
    where: { cycle: { active: true } },
    select: { trackId: true },
  })
  const activeTrackIds = new Set(activeCycleTracks.map((t) => t.trackId))

  // Find tracks whose files are present on disk but not in any active playlist
  const tracks = await prisma.track.findMany({
    where: { filePurged: false },
    select: { id: true, filename: true },
  })

  const toDelete = tracks.filter((t) => !activeTrackIds.has(t.id))

  let purged = 0
  const deletedIds = []

  for (const track of toDelete) {
    const filePath = path.join(MUSIC_STORAGE_PATH, track.filename)
    try {
      await fs.unlink(filePath)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`[Cleanup] Failed to delete ${filePath}:`, err.message)
        continue
      }
      // File already gone — mark as purged anyway
    }
    deletedIds.push(track.id)
    purged++
  }

  if (deletedIds.length > 0) {
    await prisma.track.updateMany({
      where: { id: { in: deletedIds } },
      data: { filePurged: true },
    })
  }

  if (purged > 0) {
    console.log(`[Cleanup] Purged ${purged} unused audio file(s).`)
  }

  return { purged }
}
