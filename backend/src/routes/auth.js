import bcrypt from 'bcryptjs'
import prisma from '../db.js'

export async function authRoutes(fastify) {
  // Register new user
  fastify.post('/register', async (request, reply) => {
    const { username, password } = request.body ?? {}
    if (!username || !password) {
      return reply.code(400).send({ error: 'username and password are required' })
    }
    if (password.length < 8) {
      return reply.code(400).send({ error: 'password must be at least 8 characters' })
    }

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return reply.code(409).send({ error: 'Username already taken' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({ data: { username, passwordHash } })

    // Pre-create a default cadence setting so the scheduler picks the user up immediately
    await prisma.cadenceSetting.create({ data: { userId: user.id, interval: 'weekly' } })

    const token = fastify.jwt.sign({ sub: user.id, username: user.username })
    return reply.code(201).send({ token, user: { id: user.id, username: user.username, onboardingComplete: false } })
  })

  // Login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body ?? {}
    if (!username || !password) {
      return reply.code(400).send({ error: 'username and password are required' })
    }

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const token = fastify.jwt.sign({ sub: user.id, username: user.username })
    return reply.send({ token, user: { id: user.id, username: user.username, onboardingComplete: user.onboardingComplete } })
  })

  // Get current user (requires auth)
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, username: true, createdAt: true, onboardingComplete: true },
    })
    if (!user) return reply.code(404).send({ error: 'User not found' })
    return user
  })
}
