import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'
import { tracksRoutes } from './routes/tracks.js'
import { playlistRoutes } from './routes/playlist.js'
import { ratingsRoutes } from './routes/ratings.js'
import { cadenceRoutes } from './routes/cadence.js'
import { startScheduler } from './services/schedulerService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({ logger: true })

const PORT = process.env.PORT || 3001
const MUSIC_STORAGE_PATH = process.env.MUSIC_STORAGE_PATH || path.join(__dirname, '..', 'storage', 'music')

await fastify.register(cors, { origin: true })
await fastify.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } })
await fastify.register(staticFiles, {
  root: MUSIC_STORAGE_PATH,
  prefix: '/files/',
})

await fastify.register(tracksRoutes, { prefix: '/api/tracks' })
await fastify.register(playlistRoutes, { prefix: '/api/playlist' })
await fastify.register(ratingsRoutes, { prefix: '/api/ratings' })
await fastify.register(cadenceRoutes, { prefix: '/api/cadence' })

fastify.get('/health', async () => ({ status: 'ok' }))

startScheduler()

try {
  await fastify.listen({ port: Number(PORT), host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
