const CACHE_NAME = 'varus-music-v1'
const AUDIO_CACHE_NAME = 'varus-music-audio-v1'
const DOWNLOAD_CONCURRENCY = 3

// Static assets to pre-cache on install
const STATIC_ASSETS = ['/', '/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== AUDIO_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Receive messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_PLAYLIST') {
    const urls = event.data.urls ?? []
    const total = urls.length
    if (total === 0) return

    event.waitUntil(
      caches.open(AUDIO_CACHE_NAME).then(async (cache) => {
        // Count already-fully-cached tracks first so the initial notification is accurate
        // and never resets a count that the main thread already knows.
        const existingChecks = await Promise.all(
          urls.map(async (url) => {
            const match = await cache.match(url, { ignoreVary: true })
            return match?.status === 200 ? match : null
          })
        )
        let completed = existingChecks.filter(Boolean).length
        let failed = 0

        const notifyClients = (done) => {
          self.clients
            .matchAll({ includeUncontrolled: true, type: 'window' })
            .then((clients) =>
              clients.forEach((c) =>
                c.postMessage({ type: 'CACHE_PROGRESS', cached: completed, total, failed, done })
              )
            )
        }

        // Send accurate initial count immediately
        notifyClients(completed === total)
        if (completed === total) return

        // Only fetch tracks that are not yet fully cached
        const pending = urls.filter((_, i) => !existingChecks[i])

        // Download with limited concurrency so we don't flood the connection
        let idx = 0
        async function worker() {
          while (idx < pending.length) {
            const url = pending[idx++]
            try {
              const response = await fetch(url)
              if (response.status === 200) {
                // Only store complete responses — never partial (206) content
                await cache.put(url, response)
              } else {
                failed++
              }
            } catch {
              // Individual failure — keep going for the remaining tracks
              failed++
            }
            completed++
            notifyClients(completed === total)
          }
        }

        const workers = Array.from(
          { length: Math.min(DOWNLOAD_CONCURRENCY, pending.length) },
          worker
        )
        await Promise.all(workers)
      })
    )
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Audio files: cache-first strategy
  // We only cache full (200) responses. Partial (206) responses from Range
  // requests are never stored — they would poison the cache and break future
  // full-file lookups.  If a fully-cached file is available and the browser
  // asks for a byte range, we construct a proper 206 reply from the cached
  // buffer so seeking works offline.
  if (url.pathname.startsWith('/files/')) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then(async (cache) => {
        // Always look up by canonical URL, ignoring Vary differences so that
        // Range requests still find a full-file cache entry.
        const cached = await cache.match(url.href, { ignoreVary: true })
        if (cached && cached.status === 200) {
          const rangeHeader = request.headers.get('Range')
          if (rangeHeader) {
            return buildRangeResponse(cached, rangeHeader)
          }
          return cached
        }

        // Cache miss: pass through to network.
        // CACHE_PLAYLIST is responsible for writing full files into the cache;
        // we intentionally do not write here so we never store partial content.
        try {
          return await fetch(request)
        } catch {
          return new Response('Audio not available offline', { status: 503 })
        }
      })
    )
    return
  }

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((r) => r ?? new Response('Offline', { status: 503 }))
      )
    )
    return
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone())
        return response
      })
      return cached ?? fetchPromise
    })
  )
})

/**
 * Build a 206 Partial Content response from a fully-cached 200 response.
 * Handles "bytes=start-end" and "bytes=start-" range syntax.
 */
async function buildRangeResponse(fullResponse, rangeHeader) {
  const arrayBuffer = await fullResponse.arrayBuffer()
  const total = arrayBuffer.byteLength

  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
  if (!match) {
    // Unrecognised range format — return the full file
    return new Response(arrayBuffer, { status: 200, headers: fullResponse.headers })
  }

  const start = parseInt(match[1], 10)
  const end = match[2] ? parseInt(match[2], 10) : total - 1
  const clampedEnd = Math.min(end, total - 1)
  const slice = arrayBuffer.slice(start, clampedEnd + 1)

  const headers = new Headers(fullResponse.headers)
  headers.set('Content-Range', `bytes ${start}-${clampedEnd}/${total}`)
  headers.set('Content-Length', String(slice.byteLength))
  headers.set('Accept-Ranges', 'bytes')

  return new Response(slice, {
    status: 206,
    statusText: 'Partial Content',
    headers,
  })
}
