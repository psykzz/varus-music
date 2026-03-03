/**
 * File watcher service.
 * Watches WATCH_FOLDER for new audio files and auto-ingests them as tracks.
 *
 * Expected filename pattern: "Artist - Title.mp3"
 * Falls back to filename-as-title / 'Unknown Artist' if pattern doesn't match.
 */

import chokidar from 'chokidar'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../db.js'
import { enrichTrack } from './lastfmService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MUSIC_STORAGE_PATH =
  process.env.MUSIC_STORAGE_PATH || path.join(__dirname, '..', '..', 'storage', 'music')
const WATCH_FOLDER =
  process.env.WATCH_FOLDER || path.join(__dirname, '..', '..', 'storage', 'watch')

const ALLOWED_EXTS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg'])

const MIME_MAP = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
}

/**
 * Ingest a file: copy to MUSIC_STORAGE_PATH, create DB row, enrich metadata.
 * Called both from the watcher and from the download service.
 *
 * @param {string} filePath  Absolute path of the source file
 * @param {{ title?: string, artist?: string, album?: string }} meta  Optional overrides
 * @returns {Promise<import('@prisma/client').Track>} The created Track
 */
export async function ingestFile(filePath, meta = {}) {
  await fs.mkdir(MUSIC_STORAGE_PATH, { recursive: true })

  const ext = path.extname(filePath).toLowerCase()
  const basename = path.basename(filePath, ext)

  // Parse "Artist - Title" pattern
  let parsedArtist = 'Unknown Artist'
  let parsedTitle = basename
  const dashIdx = basename.indexOf(' - ')
  if (dashIdx !== -1) {
    parsedArtist = basename.slice(0, dashIdx).trim()
    parsedTitle = basename.slice(dashIdx + 3).trim()
  }

  const title = meta.title || parsedTitle
  const artist = meta.artist || parsedArtist
  const album = meta.album || null
  const mimeType = MIME_MAP[ext] || 'audio/mpeg'

  const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}-${path
    .basename(filePath)
    .replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const destPath = path.join(MUSIC_STORAGE_PATH, filename)

  await fs.copyFile(filePath, destPath)

  const track = await prisma.track.create({
    data: { title, artist, album, filename, mimeType },
  })

  // Enrich asynchronously so ingest returns quickly
  enrichTrack(title, artist)
    .then((enriched) => {
      if (Object.keys(enriched).length > 0) {
        return prisma.track.update({ where: { id: track.id }, data: enriched })
      }
    })
    .catch((err) => console.error('[Watcher] Enrichment error:', err))

  return track
}

export function startWatcher() {
  fs.mkdir(WATCH_FOLDER, { recursive: true }).catch(() => {})

  const watcher = chokidar.watch(WATCH_FOLDER, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
  })

  watcher.on('add', async (filePath) => {
    const ext = path.extname(filePath).toLowerCase()
    if (!ALLOWED_EXTS.has(ext)) return

    console.log(`[Watcher] New file detected: ${filePath}`)
    try {
      const track = await ingestFile(filePath)
      console.log(`[Watcher] Ingested "${track.title}" by "${track.artist}" (id: ${track.id})`)
      // Remove from watch folder after successful ingest
      await fs.unlink(filePath).catch(() => {})
    } catch (err) {
      console.error('[Watcher] Ingest failed:', err)
    }
  })

  watcher.on('error', (err) => console.error('[Watcher] Error:', err))
  console.log(`[Watcher] Watching ${WATCH_FOLDER}`)
}
