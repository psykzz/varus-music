import { useState, useEffect } from 'react'
import Player from './components/Player.jsx'
import TrackList from './components/TrackList.jsx'
import CadenceSelector from './components/CadenceSelector.jsx'
import { fetchCurrentPlaylist } from './services/api.js'
import { cachePlaylist } from './services/offlineCache.js'

export default function App() {
  const [playlist, setPlaylist] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    loadPlaylist()
  }, [])

  async function loadPlaylist() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCurrentPlaylist()
      setPlaylist(data)
      setCurrentIndex(0)
      // Cache for offline use
      if (data?.tracks) {
        await cachePlaylist(data)
      }
    } catch (err) {
      setError('Failed to load playlist. ' + (isOffline ? 'You are offline.' : err.message))
    } finally {
      setLoading(false)
    }
  }

  const currentTrack = playlist?.tracks?.[currentIndex] ?? null

  function handleNext() {
    if (!playlist) return
    setCurrentIndex((i) => (i + 1) % playlist.tracks.length)
  }

  function handlePrev() {
    if (!playlist) return
    setCurrentIndex((i) => (i - 1 + playlist.tracks.length) % playlist.tracks.length)
  }

  function handleSelectTrack(index) {
    setCurrentIndex(index)
  }

  function handleRatingUpdate(trackId, value) {
    setPlaylist((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, score: (t.score ?? 0) + value } : t
        ),
      }
    })
  }

  return (
    <div className="flex flex-col h-screen bg-spotify-black">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-spotify-darkgray border-b border-spotify-gray">
        <h1 className="text-2xl font-bold text-white">🎵 Varus Music</h1>
        {isOffline && (
          <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded-full">Offline</span>
        )}
        <CadenceSelector />
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track list sidebar */}
        <aside className="w-80 bg-spotify-darkgray border-r border-spotify-gray overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-spotify-green" />
            </div>
          ) : error ? (
            <div className="p-4 text-red-400 text-sm">{error}</div>
          ) : (
            <TrackList
              tracks={playlist?.tracks ?? []}
              currentIndex={currentIndex}
              onSelect={handleSelectTrack}
              onRatingUpdate={handleRatingUpdate}
            />
          )}
        </aside>

        {/* Main player area */}
        <main className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-spotify-gray to-spotify-black p-8">
          {currentTrack ? (
            <div className="text-center mb-8">
              {/* Album art placeholder */}
              <div className="w-64 h-64 mx-auto bg-spotify-gray rounded-xl mb-6 flex items-center justify-center shadow-2xl">
                <span className="text-6xl">🎵</span>
              </div>
              <h2 className="text-2xl font-bold text-white">{currentTrack.title}</h2>
              <p className="text-spotify-lightgray mt-1">{currentTrack.artist}</p>
              {currentTrack.album && (
                <p className="text-spotify-lightgray text-sm mt-1">{currentTrack.album}</p>
              )}
            </div>
          ) : (
            <div className="text-spotify-lightgray text-center">
              <p className="text-xl">No tracks in current playlist</p>
              <p className="text-sm mt-2">Upload some music to get started</p>
            </div>
          )}
        </main>
      </div>

      {/* Bottom player bar */}
      {currentTrack && (
        <footer className="bg-spotify-gray border-t border-spotify-gray">
          <Player
            track={currentTrack}
            onNext={handleNext}
            onPrev={handlePrev}
            onRatingUpdate={handleRatingUpdate}
          />
        </footer>
      )}
    </div>
  )
}
