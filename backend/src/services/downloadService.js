/**
 * yt-dlp download service.
 * Manages a job queue (persisted in DownloadJob DB table) and spawns yt-dlp
 * subprocesses to download audio files. On completion, files are ingested
 * via the same pipeline as the watcher service.
 *
 * Requires yt-dlp to be installed and available on PATH.
 */

import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../db.js'
import { ingestFile } from './watcherService.js'
import { addTrackToActivePlaylist } from './playlistService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MUSIC_STORAGE_PATH =
  process.env.MUSIC_STORAGE_PATH || path.join(__dirname, '..', '..', 'storage', 'music')

const MAX_CONCURRENT = 2

// In-memory set of job IDs currently running
const running = new Set()

/**
 * Enqueue a new download job.
 * @param {string} url
 * @param {string} userId
 * @param {{ title?: string, artist?: string, trackId?: string }} meta
 *   When `trackId` is provided the job is treated as a restore: the existing
 *   Track row is updated with the new filename instead of creating a new row.
 */
export async function enqueueDownload(url, userId, meta = {}) {
  const job = await prisma.downloadJob.create({
    data: {
      userId,
      url,
      title: meta.title || null,
      artist: meta.artist || null,
      status: 'pending',
      trackId: meta.trackId || null,
    },
  })
  processQueue()
  return job
}

/**
 * Process the next pending jobs up to MAX_CONCURRENT.
 */
async function processQueue() {
  if (running.size >= MAX_CONCURRENT) return

  const pending = await prisma.downloadJob.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: MAX_CONCURRENT - running.size,
  })

  for (const job of pending) {
    if (running.size >= MAX_CONCURRENT) break
    running.add(job.id)
    runJob(job).finally(() => {
      running.delete(job.id)
      processQueue()
    })
  }
}

async function runJob(job) {
  await prisma.downloadJob.update({ where: { id: job.id }, data: { status: 'downloading' } })
  await fs.mkdir(MUSIC_STORAGE_PATH, { recursive: true })

  // Use a temp directory to download then ingest
  const tempDir = path.join(MUSIC_STORAGE_PATH, `_tmp_${job.id}`)
  await fs.mkdir(tempDir, { recursive: true })

  const outputTemplate = path.join(tempDir, '%(artist)s - %(title)s.%(ext)s')

  return new Promise((resolve) => {
    const args = [
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--no-playlist',
      '--no-continue',
      '-o', outputTemplate,
      job.url,
    ]

    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''

    proc.stderr.on('data', (d) => { stderr += d.toString() })

    proc.on('close', async (code) => {
      try {
        if (code !== 0) {
          await prisma.downloadJob.update({
            where: { id: job.id },
            data: { status: 'error', error: stderr.slice(-500) },
          })
          return
        }

        // Find the downloaded file
        const files = await fs.readdir(tempDir)
        const audioFile = files.find((f) => /\.(mp3|wav|flac|m4a|ogg)$/i.test(f))

        if (!audioFile) {
          await prisma.downloadJob.update({
            where: { id: job.id },
            data: { status: 'error', error: 'No audio file produced by yt-dlp' },
          })
          return
        }

        const fullPath = path.join(tempDir, audioFile)

        if (job.trackId) {
          // Restore flow: re-download a purged track, update the existing record
          const newFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}-${audioFile.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          const destPath = path.join(MUSIC_STORAGE_PATH, newFilename)
          await fs.copyFile(fullPath, destPath)

          await prisma.track.update({
            where: { id: job.trackId },
            data: { filename: newFilename, filePurged: false },
          })

          await prisma.downloadJob.update({
            where: { id: job.id },
            data: { status: 'done' },
          })

          await addTrackToActivePlaylist(job.userId, job.trackId)
        } else {
          // Normal flow: create a new Track row
          const track = await ingestFile(fullPath, {
            title: job.title || undefined,
            artist: job.artist || undefined,
          })

          // Store the source URL so the track can be re-downloaded if purged
          await prisma.track.update({
            where: { id: track.id },
            data: { sourceUrl: job.url },
          })

          await prisma.downloadJob.update({
            where: { id: job.id },
            data: { status: 'done', title: track.title, artist: track.artist, trackId: track.id },
          })

          // Immediately add the downloaded track to the user's active playlist
          await addTrackToActivePlaylist(job.userId, track.id)
        }
      } catch (err) {
        await prisma.downloadJob.update({
          where: { id: job.id },
          data: { status: 'error', error: err.message },
        }).catch(() => {})
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
        resolve()
      }
    })
  })
}

/**
 * Search for audio candidates using yt-dlp's --dump-json + ytsearch.
 * Returns an array of { title, uploader, duration, url }.
 */
export async function searchAudio(query, limit = 5) {
  return new Promise((resolve) => {
    const results = []
    const proc = spawn('yt-dlp', [
      '--dump-json',
      '--flat-playlist',
      '--no-warnings',
      `ytsearch${limit}:${query}`,
    ], { stdio: ['ignore', 'pipe', 'ignore'] })

    let buffer = ''
    proc.stdout.on('data', (d) => { buffer += d.toString() })

    proc.on('close', () => {
      for (const line of buffer.split('\n')) {
        if (!line.trim()) continue
        try {
          const item = JSON.parse(line)
          results.push({
            title: item.title,
            uploader: item.uploader || item.channel,
            duration: item.duration,
            url: item.webpage_url || item.url,
            thumbnail: item.thumbnail,
          })
        } catch (_) {}
      }
      resolve(results)
    })
  })
}

/**
 * Resume any jobs that were left in 'downloading' state (e.g. after server restart).
 */
export async function resumePendingJobs() {
  // Mark stuck 'downloading' jobs back to 'pending'
  await prisma.downloadJob.updateMany({
    where: { status: 'downloading' },
    data: { status: 'pending' },
  })
  processQueue()
}
