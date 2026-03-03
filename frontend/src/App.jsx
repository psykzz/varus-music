import { useState, useEffect, useRef } from 'react'
import Player from './components/Player.jsx'
import TrackList from './components/TrackList.jsx'
import CadenceSelector from './components/CadenceSelector.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import DownloadPanel from './components/DownloadPanel.jsx'
import InstallBanner from './components/InstallBanner.jsx'
import OnboardingModal from './components/OnboardingModal.jsx'
import BuildingPlaylistScreen from './components/BuildingPlaylistScreen.jsx'
import DebugPage from './components/DebugPage.jsx'
import { fetchCurrentPlaylist, seedForUser, refreshPlaylist, rotatePlaylist } from './services/api.js'
import { cachePlaylist, getCachedPlaylist, getAudioCacheStatus } from './services/offlineCache.js'
import { isAuthenticated, getUser, logout } from './services/auth.js'
import MobileTabBar from './components/MobileTabBar.jsx'

export default function App() {
  const [user, setUser] = useState(() => (isAuthenticated() ? getUser() : null))
  const [playlist, setPlaylist] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [showDownload, setShowDownload] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [newTrackIds, setNewTrackIds] = useState(new Set())
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const u = isAuthenticated() ? getUser() : null
    return u ? u.onboardingComplete === false : false
  })
  // True while the initial seeding/download is in progress (survives page reloads).
  const [buildingPlaylist, setBuildingPlaylist] = useState(
    () => localStorage.getItem('varus_building') === 'true'
  )
  const [shuffle, setShuffle] = useState(() => localStorage.getItem('varus:shuffle') === 'true')
  const [loop, setLoop] = useState(() => localStorage.getItem('varus:loop') === 'true')
  // null = hidden; { cached, total, done } while caching is in progress
  const [cacheProgress, setCacheProgress] = useState(null)
  // Mobile UI state
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const [mobileView, setMobileView] = useState('nowplaying')
  // User menu
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef(null)

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
    if (!showUserMenu) return
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  // Listen for caching progress messages from the service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event) => {
      if (event.data?.type !== 'CACHE_PROGRESS') return
      const { cached, total, failed, done } = event.data
      setCacheProgress({ cached, total, failed: failed ?? 0, done })
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    if (user) loadPlaylist()
  }, [user])

  function restoreTrackIndex(tracks) {
    const savedId = localStorage.getItem('varus:lastTrackId')
    if (savedId) {
      const idx = tracks.findIndex((t) => String(t.id) === savedId)
      if (idx !== -1) return idx
    }
    return 0
  }

  function persistNewTracks(cycleId, ids) {
    localStorage.setItem('varus:newTracks', JSON.stringify({ cycleId: String(cycleId), ids: [...ids] }))
  }

  async function loadPlaylist() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCurrentPlaylist()
      setPlaylist(data)
      setCurrentIndex(data?.tracks ? restoreTrackIndex(data.tracks) : 0)
      if (data?.tracks) {
        // Show current cached-file count immediately so the UI is accurate before SW messages arrive
        const urls = data.tracks.map((t) => `/files/${t.filename}`)
        const initStatus = await getAudioCacheStatus(urls)
        setCacheProgress({
          cached: initStatus.cached,
          total: initStatus.total,
          failed: 0,
          done: initStatus.total > 0 && initStatus.cached === initStatus.total,
        })
        // Trigger background pre-caching via the service worker (progress arrives as CACHE_PROGRESS messages)
        cachePlaylist(data)
      }
      // Restore NEW-badge state for this cycle from localStorage
      if (data?.id) {
        try {
          const saved = localStorage.getItem('varus:newTracks')
          if (saved) {
            const { cycleId, ids } = JSON.parse(saved)
            setNewTrackIds(String(cycleId) === String(data.id) ? new Set(ids.map(String)) : new Set())
          } else {
            setNewTrackIds(new Set())
          }
        } catch {
          setNewTrackIds(new Set())
        }
      }
      return data
    } catch (err) {
      // Offline fallback: try IndexedDB cache
      const cached = await getCachedPlaylist()
      if (cached) {
        setPlaylist(cached)
        setCurrentIndex(cached?.tracks ? restoreTrackIndex(cached.tracks) : 0)
      } else {
        setError('Failed to load playlist. ' + (isOffline ? 'You are offline.' : (err?.message || 'Unknown error')))
      }
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleRotate() {
    // Keep loading spinner active for the full duration (API call + re-fetch)
    setLoading(true)
    const prevCycleId = playlist?.id != null ? String(playlist.id) : null
    const prevTrackSet = new Set((playlist?.tracks ?? []).map((t) => String(t.id)))
    try {
      await rotatePlaylist({ currentTrackId: currentTrack?.id != null ? String(currentTrack.id) : undefined })
    } catch (err) {
      setError('Failed to rotate playlist: ' + (err?.message || 'Unknown error'))
      setLoading(false)
      return
    }
    const newData = await loadPlaylist()
    if (newData && String(newData.id) !== prevCycleId) {
      const freshIds = new Set(
        (newData.tracks ?? []).map((t) => String(t.id)).filter((id) => !prevTrackSet.has(id))
      )
      setNewTrackIds(freshIds)
      persistNewTracks(String(newData.id), freshIds)
    }
  }

  const currentTrack = playlist?.tracks?.[currentIndex] ?? null

  // Persist the current track ID so it can be restored on reload
  useEffect(() => {
    if (currentTrack?.id != null) {
      localStorage.setItem('varus:lastTrackId', String(currentTrack.id))
    }
  }, [currentTrack?.id])

  // Remove NEW badge for a track when it becomes the current (i.e. is played)
  useEffect(() => {
    if (currentTrack?.id == null) return
    const id = String(currentTrack.id)
    setNewTrackIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      if (playlist?.id != null) persistNewTracks(String(playlist.id), next)
      return next
    })
  }, [currentTrack?.id])

  function handleNext() {
    if (!playlist) return
    if (shuffle) {
      const len = playlist.tracks.length
      setCurrentIndex((i) => {
        if (len <= 1) return i
        let next
        do { next = Math.floor(Math.random() * len) } while (next === i)
        return next
      })
    } else {
      setCurrentIndex((i) => (i + 1) % playlist.tracks.length)
    }
  }

  function handleToggleShuffle() {
    setShuffle((v) => { localStorage.setItem('varus:shuffle', String(!v)); return !v })
  }

  function handleToggleLoop() {
    setLoop((v) => { localStorage.setItem('varus:loop', String(!v)); return !v })
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

  async function handleSeedLibrary() {
    setSeeding(true)
    try {
      await seedForUser([])
      await refreshPlaylist()
      await loadPlaylist()
    } catch (err) {
      setError('Failed to seed library: ' + (err?.message || 'Unknown error'))
    } finally {
      setSeeding(false)
    }
  }

  function handleLogout() {
    logout()
    setUser(null)
    setPlaylist(null)
  }

  // Show auth screen if not logged in
  if (!user) {
    return (
      <AuthScreen
        onAuth={(u) => {
          setUser(u)
          if (u.onboardingComplete === false) setShowOnboarding(true)
          if (localStorage.getItem('varus_building') === 'true') setBuildingPlaylist(true)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-spotify-black">
      {/* Header */}
      <header className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 bg-spotify-darkgray border-b border-spotify-gray gap-2 md:gap-4 pt-safe">
        <h1 className="text-xl font-bold text-white shrink-0">🎵 Varus Music</h1>
        <div className="flex items-center gap-3">
          {isOffline && (
            <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded-full shrink-0">Offline</span>
          )}
          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="w-8 h-8 rounded-full bg-spotify-green text-black text-sm font-bold flex items-center justify-center hover:bg-green-400 transition-colors"
              title={user.username}
              aria-label="Open user menu"
            >
              {user.username[0].toUpperCase()}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-spotify-darkgray border border-spotify-gray rounded-lg shadow-xl z-50 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-spotify-gray">
                  <p className="text-sm font-medium text-white">{user.username}</p>
                </div>
                {/* Cadence */}
                <div className="px-4 py-3 border-b border-spotify-gray">
                  <p className="text-xs text-spotify-lightgray uppercase tracking-wider mb-2">Cadence</p>
                  <CadenceSelector onRotate={handleRotate} isRotating={loading} hideRotate />
                </div>
                {/* Actions */}
                <div className="py-1">
                  <button
                    onClick={() => { handleRotate(); setShowUserMenu(false) }}
                    disabled={loading}
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-spotify-gray transition-colors flex items-center gap-3 disabled:opacity-50"
                  >
                    <ForceCycleIcon spinning={loading} />
                    Force Cycle
                  </button>
                  <button
                    onClick={() => { setShowDownload(true); setShowUserMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-spotify-gray transition-colors flex items-center gap-3"
                  >
                    <DownloadIcon />
                    Download Music
                  </button>
                  <button
                    onClick={() => { setShowDebug(true); setShowUserMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-spotify-gray transition-colors flex items-center gap-3"
                  >
                    <DebugIcon />
                    Debug Info
                  </button>
                  <button
                    onClick={() => { handleLogout(); setShowUserMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-spotify-gray transition-colors flex items-center gap-3"
                  >
                    <LogoutIcon />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track list sidebar — desktop only */}
        <aside className="hidden md:flex md:flex-col w-80 bg-spotify-darkgray border-r border-spotify-gray overflow-y-auto">
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
              onSeedLibrary={handleSeedLibrary}
              seeding={seeding}
              newTrackIds={newTrackIds}
              cacheProgress={cacheProgress}
            />
          )}
        </aside>

        {/* Main player area */}
        <main className="flex-1 overflow-hidden relative bg-spotify-black">
          {/* ── Mobile: Queue panel ── */}
          <div className={`md:hidden ${mobileView === 'queue' ? 'flex' : 'hidden'} flex-col h-full overflow-y-auto bg-spotify-darkgray pb-[132px]`}>
            {loading ? (
              <div className="flex items-center justify-center flex-1 h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-spotify-green" />
              </div>
            ) : error ? (
              <div className="p-4 text-red-400 text-sm">{error}</div>
            ) : (
              <TrackList
                tracks={playlist?.tracks ?? []}
                currentIndex={currentIndex}
                onSelect={(i) => { handleSelectTrack(i); setMobileView('nowplaying') }}
                onRatingUpdate={handleRatingUpdate}
                onSeedLibrary={handleSeedLibrary}
                seeding={seeding}
                newTrackIds={newTrackIds}
                cacheProgress={cacheProgress}
              />
            )}
          </div>

          {/* ── Now Playing panel — desktop always, mobile only when 'nowplaying' ── */}
          <div className={`${mobileView === 'nowplaying' ? 'flex' : 'hidden'} md:flex flex-col items-center justify-center h-full overflow-y-auto bg-gradient-to-b from-spotify-gray to-spotify-black p-6 md:p-8 pb-[132px] md:pb-8`}>
            {currentTrack ? (
              <div className="text-center w-full max-w-sm mx-auto">
                {/* Album art */}
                <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 mx-auto rounded-xl mb-5 shadow-2xl overflow-hidden bg-spotify-gray flex items-center justify-center">
                  {currentTrack.albumArtUrl ? (
                    <img
                      src={currentTrack.albumArtUrl}
                      alt={`${currentTrack.album || currentTrack.title} cover`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-6xl">🎵</span>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white">{currentTrack.title}</h2>
                <p className="text-spotify-lightgray mt-1">{currentTrack.artist}</p>
                {currentTrack.album && (
                  <p className="text-spotify-lightgray text-sm mt-1">{currentTrack.album}</p>
                )}
              </div>
            ) : (
              <div className="text-center px-4">
                <span className="text-6xl mb-6 block">🎵</span>
                <p className="text-xl text-white font-semibold">Your library is empty</p>
                <p className="text-spotify-lightgray text-sm mt-2 mb-6">
                  Download music, or kick-start your library with popular tracks across a mix of genres.
                </p>
                <button
                  onClick={handleSeedLibrary}
                  disabled={seeding}
                  className="px-6 py-3 bg-spotify-green text-black font-bold rounded-full hover:bg-green-400 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {seeding ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-black inline-block" />
                      Queuing tracks…
                    </>
                  ) : (
                    'Seed with popular tracks'
                  )}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bottom player bar — desktop footer; mobile renders fixed mini-bar via Player itself */}
      {currentTrack && (
        <footer className="md:bg-spotify-gray md:border-t md:border-spotify-gray">
          <Player
            track={currentTrack}
            onNext={handleNext}
            onPrev={handlePrev}
            onRatingUpdate={handleRatingUpdate}
            shuffle={shuffle}
            loop={loop}
            onToggleShuffle={handleToggleShuffle}
            onToggleLoop={handleToggleLoop}
            mobileExpanded={mobileExpanded}
            onExpandedChange={setMobileExpanded}
          />
        </footer>
      )}

      {/* Mobile tab bar — fixed above mini-player */}
      <MobileTabBar activeView={mobileView} onChange={setMobileView} />

      {/* Download panel modal */}
      {showDownload && <DownloadPanel onClose={() => setShowDownload(false)} onDownloadComplete={loadPlaylist} />}

      {/* Debug page overlay */}
      {showDebug && <DebugPage onClose={() => setShowDebug(false)} />}

      {/* Onboarding modal — shown once for new users */}
      {showOnboarding && !buildingPlaylist && (
        <OnboardingModal
          onComplete={() => {
            setShowOnboarding(false)
            setBuildingPlaylist(true)
            loadPlaylist()
          }}
        />
      )}

      {/* Building screen — shown on reloads while the initial download is in flight */}
      {buildingPlaylist && (
        <BuildingPlaylistScreen
          onReady={(data) => {
            localStorage.removeItem('varus_building')
            setBuildingPlaylist(false)
            setPlaylist(data)
            setCurrentIndex(data?.tracks ? restoreTrackIndex(data.tracks) : 0)
          }}
        />
      )}

      {/* Offline cache progress is now shown inline in the TrackList header */}

      {/* PWA install banner */}
      <InstallBanner />
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function DebugIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function ForceCycleIcon({ spinning }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${spinning ? 'animate-spin' : ''}`}
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

