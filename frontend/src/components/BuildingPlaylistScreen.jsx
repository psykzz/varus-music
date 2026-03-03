import { useEffect, useRef } from 'react'
import { fetchCurrentPlaylist } from '../services/api.js'

const POLL_INTERVAL_MS = 5_000

/**
 * Full-screen overlay shown while the initial playlist is being built
 * (i.e. after genre selection but before downloads have completed).
 *
 * Polls the playlist endpoint every 5 s.  Once at least one track is
 * available it calls `onReady(playlistData)` so the parent can transition
 * to the normal player view and clear the `varus_building` flag.
 */
export default function BuildingPlaylistScreen({ onReady }) {
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const data = await fetchCurrentPlaylist()
        if (!cancelled && data?.tracks?.length > 0) {
          onReady(data)
          return // stop polling
        }
      } catch {
        // Network error — keep polling
      }
      if (!cancelled) {
        timerRef.current = setTimeout(check, POLL_INTERVAL_MS)
      }
    }

    // First check immediately, then poll
    check()

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  }, [onReady])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-spotify-darkgray rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-spotify-green mx-auto mb-6" />
        <h2 className="text-white text-xl font-bold mb-2">Building your library…</h2>
        <p className="text-spotify-lightgray text-sm">
          We're downloading popular tracks for you. This page will update automatically once music
          is ready — no need to do anything.
        </p>
      </div>
    </div>
  )
}
