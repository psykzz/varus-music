const CACHE_NAME = 'varus-music-v1'
const AUDIO_CACHE_NAME = 'varus-music-audio-v1'

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
    event.waitUntil(
      caches.open(AUDIO_CACHE_NAME).then((cache) =>
        Promise.allSettled(urls.map((url) => cache.add(url)))
      )
    )
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Audio files: cache-first strategy
  if (url.pathname.startsWith('/files/')) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        try {
          const response = await fetch(request)
          if (response.ok) {
            cache.put(request, response.clone())
          }
          return response
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
