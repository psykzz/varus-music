import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import prisma from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MUSIC_STORAGE_PATH = process.env.MUSIC_STORAGE_PATH || path.join(__dirname, '..', '..', 'storage', 'music')

export async function tracksRoutes(fastify) {
  // List all tracks
  fastify.get('/', async (request, reply) => {
    const tracks = await prisma.track.findMany({
      include: {
        ratings: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return tracks.map((track) => ({
      ...track,
      score: track.ratings.reduce((sum, r) => sum + r.value, 0),
    }))
  })

  // Get single track
  fastify.get('/:id', async (request, reply) => {
    const track = await prisma.track.findUnique({
      where: { id: request.params.id },
      include: { ratings: true },
    })
    if (!track) return reply.code(404).send({ error: 'Track not found' })
    return { ...track, score: track.ratings.reduce((sum, r) => sum + r.value, 0) }
  })

  // Upload a track
  fastify.post('/upload', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    await fs.mkdir(MUSIC_STORAGE_PATH, { recursive: true })
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })

    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav']
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Only MP3/WAV allowed.' })
    }

    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filepath = path.join(MUSIC_STORAGE_PATH, filename)
    await pipeline(data.file, (await import('fs')).createWriteStream(filepath))

    const title = data.fields?.title?.value || data.filename.replace(/\.[^/.]+$/, '')
    const artist = data.fields?.artist?.value || 'Unknown Artist'
    const album = data.fields?.album?.value || null

    const track = await prisma.track.create({
      data: { title, artist, album, filename, mimeType: data.mimetype },
    })
    return reply.code(201).send(track)
  })

  // Delete a track
  fastify.delete('/:id', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const track = await prisma.track.findUnique({ where: { id: request.params.id } })
    if (!track) return reply.code(404).send({ error: 'Track not found' })

    try {
      await fs.unlink(path.join(MUSIC_STORAGE_PATH, track.filename))
    } catch (_) {
      // file may already be gone
    }
    await prisma.track.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })
}
