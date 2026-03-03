const DB_NAME = 'varus-music'
const DB_VERSION = 1
const PLAYLIST_STORE = 'playlist'
const TRACKS_STORE = 'tracks'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(PLAYLIST_STORE)) {
        db.createObjectStore(PLAYLIST_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        db.createObjectStore(TRACKS_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Cache the current playlist metadata in IndexedDB and
 * request the Service Worker to cache the audio files.
 */
export async function cachePlaylist(playlist) {
  try {
    const db = await openDB()

    // Store playlist metadata under a fixed key for efficient retrieval
    const tx = db.transaction([PLAYLIST_STORE, TRACKS_STORE], 'readwrite')
    tx.objectStore(PLAYLIST_STORE).put({ ...playlist, id: 'current' })
    for (const track of playlist.tracks ?? []) {
      tx.objectStore(TRACKS_STORE).put(track)
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })

    // Tell the Service Worker to pre-cache the audio files.
    // Use serviceWorker.ready so the message is never lost on first install
    // (when .controller may still be null).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({
          type: 'CACHE_PLAYLIST',
          urls: (playlist.tracks ?? []).map((t) => `/files/${t.filename}`),
        })
      })
    }
  } catch (err) {
    console.warn('Failed to cache playlist:', err)
  }
}

/**
 * Query the Service Worker audio cache to find how many of the given
 * /files/<filename> URLs are already cached.  Safe to call from the main
 * thread — uses the Cache API directly.
 *
 * Returns { cached: number, total: number }
 */
export async function getAudioCacheStatus(urls = []) {
  if (!('caches' in window) || urls.length === 0) return { cached: 0, total: urls.length }
  try {
    const cache = await caches.open('varus-music-audio-v1')
    const results = await Promise.all(urls.map((url) => cache.match(url)))
    const cached = results.filter(Boolean).length
    return { cached, total: urls.length }
  } catch {
    return { cached: 0, total: urls.length }
  }
}

/**
 * Retrieve the cached playlist from IndexedDB (for offline use).
 */
export async function getCachedPlaylist() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PLAYLIST_STORE, 'readonly')
      const req = tx.objectStore(PLAYLIST_STORE).get('current')
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('Failed to get cached playlist:', err)
    return null
  }
}