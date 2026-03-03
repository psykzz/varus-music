import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { tracksRoutes } from './routes/tracks.js'
import { playlistRoutes } from './routes/playlist.js'
import { ratingsRoutes } from './routes/ratings.js'
import { cadenceRoutes } from './routes/cadence.js'
import { authRoutes } from './routes/auth.js'
import { downloadRoutes } from './routes/download.js'
import { onboardingRoutes } from './routes/onboarding.js'
import { debugRoutes } from './routes/debug.js'
import { startScheduler } from './services/schedulerService.js'
import { startWatcher } from './services/watcherService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({ logger: true })

const PORT = process.env.PORT || 3001
const MUSIC_STORAGE_PATH = process.env.MUSIC_STORAGE_PATH || path.join(__dirname, '..', 'storage', 'music')
const JWT_SECRET = process.env.JWT_SECRET || 'varus-music-dev-secret-change-in-production'

// Ensure required directories exist before registering static plugin
await fs.mkdir(MUSIC_STORAGE_PATH, { recursive: true })
await fs.mkdir(process.env.WATCH_FOLDER || path.join(__dirname, '..', 'storage', 'watch'), { recursive: true })

await fastify.register(cors, { origin: true })
await fastify.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } })
await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' })
await fastify.register(staticFiles, {
  root: MUSIC_STORAGE_PATH,
  prefix: '/files/',
})
await fastify.register(jwt, { secret: JWT_SECRET })

// Decorate with authenticate helper used as preHandler in protected routes
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' })
  }
})

await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(tracksRoutes, { prefix: '/api/tracks' })
await fastify.register(playlistRoutes, { prefix: '/api/playlist' })
await fastify.register(ratingsRoutes, { prefix: '/api/ratings' })
await fastify.register(cadenceRoutes, { prefix: '/api/cadence' })
await fastify.register(downloadRoutes, { prefix: '/api/download' })
await fastify.register(onboardingRoutes, { prefix: '/api/onboarding' })
await fastify.register(debugRoutes, { prefix: '/api/debug' })

fastify.get('/health', async () => ({ status: 'ok' }))

startScheduler()
startWatcher()

try {
  await fastify.listen({ port: Number(PORT), host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
