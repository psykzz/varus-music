import path from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import prisma from '../db.js'
import { enrichTrack } from '../services/lastfmService.js'
import { ingestFile } from '../services/watcherService.js'
import { enqueueDownload } from '../services/downloadService.js'
import { evaluateImplicitRating } from '../services/implicitRatingService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MUSIC_STORAGE_PATH = process.env.MUSIC_STORAGE_PATH || path.join(__dirname, '..', '..', 'storage', 'music')

export async function tracksRoutes(fastify) {
  // List all tracks (public)
  fastify.get('/', async () => {
    const tracks = await prisma.track.findMany({
      include: { ratings: true },
      orderBy: { createdAt: 'desc' },
    })
    return tracks.map((track) => ({
      ...track,
      score: track.ratings.reduce((sum, r) => sum + r.value, 0),
    }))
  })

  // Get single track (public)
  fastify.get('/:id', async (request, reply) => {
    const track = await prisma.track.findUnique({
      where: { id: request.params.id },
      include: { ratings: true },
    })
    if (!track) return reply.code(404).send({ error: 'Track not found' })
    return { ...track, score: track.ratings.reduce((sum, r) => sum + r.value, 0) }
  })

  // Upload a track (requires auth)
  fastify.post('/upload', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { default: fs } = await import('fs')
    const { promises: fsPromises } = await import('fs')
    await fsPromises.mkdir(MUSIC_STORAGE_PATH, { recursive: true })

    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })

    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/flac', 'audio/mp4', 'audio/ogg']
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Allowed: MP3, WAV, FLAC, M4A, OGG.' })
    }

    // Write to a temp file, then use ingestFile for consistent processing
    const tempPath = path.join(MUSIC_STORAGE_PATH, `_upload_${Date.now()}_${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
    await pipeline(data.file, fs.createWriteStream(tempPath))

    const title = data.fields?.title?.value || data.filename.replace(/\.[^/.]+$/, '')
    const artist = data.fields?.artist?.value || 'Unknown Artist'
    const album = data.fields?.album?.value || null

    const track = await ingestFile(tempPath, { title, artist, album })
    // Clean up temp file (ingestFile copies it)
    await fsPromises.unlink(tempPath).catch(() => {})

    return reply.code(201).send(track)
  })

  // Record a play-through — increments per-user playCount and evaluates implicit rating
  fastify.post('/:id/complete', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const trackId = request.params.id
    const userId = request.user.sub

    const track = await prisma.track.findUnique({ where: { id: trackId } })
    if (!track) return reply.code(404).send({ error: 'Track not found' })

    const stats = await prisma.userTrackStats.upsert({
      where: { userId_trackId: { userId, trackId } },
      create: { userId, trackId, playCount: 1 },
      update: { playCount: { increment: 1 } },
    })

    await evaluateImplicitRating(userId, trackId)

    return { id: trackId, playCount: stats.playCount }
  })

  // Record a skip — increments per-user skipCount and evaluates implicit rating
  fastify.post('/:id/skip', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const trackId = request.params.id
    const userId = request.user.sub

    const track = await prisma.track.findUnique({ where: { id: trackId } })
    if (!track) return reply.code(404).send({ error: 'Track not found' })

    const stats = await prisma.userTrackStats.upsert({
      where: { userId_trackId: { userId, trackId } },
      create: { userId, trackId, skipCount: 1 },
      update: { skipCount: { increment: 1 } },
    })

    await evaluateImplicitRating(userId, trackId)

    return { id: trackId, net: stats.playCount - stats.skipCount }
  })

  // Manually re-enrich a track from Last.fm (requires auth)
  fastify.post('/:id/enrich', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const track = await prisma.track.findUnique({ where: { id: request.params.id } })
    if (!track) return reply.code(404).send({ error: 'Track not found' })

    const enriched = await enrichTrack(track.title, track.artist)
    if (Object.keys(enriched).length === 0) {
      return reply.send({ message: 'No metadata found', track })
    }

    const updated = await prisma.track.update({ where: { id: track.id }, data: enriched })
    return updated
  })

  // Restore a purged track by re-downloading it from its sourceUrl (requires auth)
  fastify.post('/:id/restore', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const track = await prisma.track.findUnique({ where: { id: request.params.id } })
    if (!track) return reply.code(404).send({ error: 'Track not found' })
    if (!track.filePurged) return reply.code(400).send({ error: 'Track file already exists' })
    if (!track.sourceUrl) return reply.code(400).send({ error: 'No source URL available for re-download' })

    const job = await enqueueDownload(track.sourceUrl, request.user.sub, {
      title: track.title,
      artist: track.artist,
      trackId: track.id,
    })
    return reply.code(202).send({ message: 'Restore download enqueued', jobId: job.id })
  })

  // Delete a track (requires auth)
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { promises: fsPromises } = await import('fs')
    const track = await prisma.track.findUnique({ where: { id: request.params.id } })
    if (!track) return reply.code(404).send({ error: 'Track not found' })

    try {
      await fsPromises.unlink(path.join(MUSIC_STORAGE_PATH, track.filename))
    } catch (_) {
      // file may already be gone
    }
    await prisma.track.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })
}
