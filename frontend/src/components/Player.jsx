import { useEffect, useRef, useState } from 'react'
import RatingButtons from './RatingButtons.jsx'
import { completeTrack } from '../services/api.js'

export default function Player({
  track,
  onNext,
  onPrev,
  onRatingUpdate,
  shuffle = false,
  loop = false,
  onToggleShuffle,
  onToggleLoop,
  // Mobile-specific: controlled expanded/collapsed state
  mobileExpanded = false,
  onExpandedChange = () => {},
}) {
  const audioRef = useRef(null)
  // Always holds the latest track so the ended handler sees the current id
  const trackRef = useRef(track)
  trackRef.current = track
  // Always holds the latest loop flag so the ended handler sees the current value
  const loopRef = useRef(loop)
  loopRef.current = loop
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    const saved = parseFloat(localStorage.getItem('varus:volume'))
    return isNaN(saved) ? 1 : saved
  })

  // Apply persisted volume on mount
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [])

  // Media Session API — lock-screen / headset controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || '',
      artwork: track.albumArtUrl
        ? [{ src: track.albumArtUrl, sizes: '300x300', type: 'image/jpeg' }]
        : [],
    })

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause()
    })
    navigator.mediaSession.setActionHandler('previoustrack', onPrev)
    navigator.mediaSession.setActionHandler('nexttrack', onNext)

    return () => {
      ;['play', 'pause', 'previoustrack', 'nexttrack'].forEach((a) => {
        try { navigator.mediaSession.setActionHandler(a, null) } catch (_) {}
      })
    }
  }, [track?.id, onNext, onPrev])

  // When track changes, reset and autoplay
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load()
      setCurrentTime(0)
      setDuration(0)
      if (isPlayingRef.current) {
        audioRef.current.play().catch((err) => { console.error('Autoplay failed:', err); setIsPlaying(false); isPlayingRef.current = false })
      }
    }
  }, [track?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => setDuration(audio.duration || 0)
    const handleEnded = () => {
      // Only fires on natural completion (audio ended without skip)
      if (trackRef.current?.id) completeTrack(trackRef.current.id).catch(() => {})
      if (loopRef.current) {
        // Restart the current track
        audio.currentTime = 0
        audio.play().catch(() => {})
      } else {
        onNext()
      }
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [onNext])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      // Hardware media keys — handle regardless of focused element
      switch (e.key) {
        case 'MediaPlayPause':
          if (isPlayingRef.current) { audioRef.current?.pause() } else { audioRef.current?.play().catch(() => {}) }
          return
        case 'MediaTrackNext':
          onNext()
          return
        case 'MediaTrackPrevious':
          onPrev()
          return
        case 'MediaStop':
          audioRef.current?.pause()
          return
        default:
          break
      }

      // Don't intercept other keys from input elements
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (isPlayingRef.current) { audioRef.current?.pause() } else { audioRef.current?.play().catch(() => {}) }
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5)
          break
        case 'ArrowRight':
          e.preventDefault()
          if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 5)
          break
        case 'ArrowUp':
          e.preventDefault()
          if (audioRef.current) applyVolume(audioRef.current.volume + 0.05)
          break
        case 'ArrowDown':
          e.preventDefault()
          if (audioRef.current) applyVolume(audioRef.current.volume - 0.05)
          break
        case 'n':
        case 'N':
          onNext()
          break
        case 'p':
        case 'P':
          onPrev()
          break
        case 'l':
        case 'L':
          onToggleLoop?.()
          break
        case 's':
        case 'S':
          onToggleShuffle?.()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNext, onPrev])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (isPlayingRef.current) {
      audio.pause()
      setIsPlaying(false)
      isPlayingRef.current = false
    } else {
      audio.play().then(() => { setIsPlaying(true); isPlayingRef.current = true }).catch((err) => { console.error('Play failed:', err); setIsPlaying(false); isPlayingRef.current = false })
    }
  }

  function handleSeek(e) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * duration
  }

  function applyVolume(v) {
    const clamped = Math.min(1, Math.max(0, v))
    setVolume(clamped)
    if (audioRef.current) audioRef.current.volume = clamped
    localStorage.setItem('varus:volume', clamped)
  }

  function handleVolumeChange(e) {
    applyVolume(parseFloat(e.target.value))
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <>
      {/* Audio element — always in DOM so playback continues regardless of UI mode */}
      <audio
        ref={audioRef}
        src={`/files/${track.filename}`}
        onPlay={() => { setIsPlaying(true); isPlayingRef.current = true }}
        onPause={() => { setIsPlaying(false); isPlayingRef.current = false }}
        preload="metadata"
      />

      {/* ── Desktop player bar (md and above) ── */}
      <div className="hidden md:flex flex-col px-6 py-3 gap-2">
        {/* Progress bar */}
        <div className="flex items-center gap-2 text-xs text-spotify-lightgray">
          <span>{formatTime(currentTime)}</span>
          <div
            className="flex-1 h-1.5 bg-spotify-darkgray rounded-full cursor-pointer relative group"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-spotify-green rounded-full group-hover:bg-white transition-colors"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          {/* Track info */}
          <div className="w-48 truncate">
            <p className="text-sm font-medium text-white truncate">{track.title}</p>
            <p className="text-xs text-spotify-lightgray truncate">{track.artist}</p>
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={onToggleShuffle}
              className={`transition-colors ${shuffle ? 'text-spotify-green' : 'text-spotify-lightgray hover:text-white'}`}
              aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'}
              title="Shuffle (S)"
            >
              <ShuffleIcon />
            </button>
            <button
              onClick={onPrev}
              className="text-spotify-lightgray hover:text-white transition-colors"
              aria-label="Previous"
            >
              <PrevIcon />
            </button>
            <button
              onClick={togglePlay}
              className="w-11 h-11 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              onClick={onNext}
              className="text-spotify-lightgray hover:text-white transition-colors"
              aria-label="Next"
            >
              <NextIcon />
            </button>
            <button
              onClick={onToggleLoop}
              className={`transition-colors ${loop ? 'text-spotify-green' : 'text-spotify-lightgray hover:text-white'}`}
              aria-label={loop ? 'Loop on' : 'Loop off'}
              title="Loop (L)"
            >
              <LoopIcon />
            </button>
          </div>

          {/* Volume + Rating */}
          <div className="flex items-center gap-4 w-48 justify-end">
            <RatingButtons track={track} onRatingUpdate={onRatingUpdate} />
            <div className="flex items-center gap-1">
              <VolumeIcon />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 accent-spotify-green"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile mini-bar (below md, collapsed) ── */}
      <div
        className="md:hidden fixed bottom-16 left-0 right-0 z-40 bg-spotify-gray cursor-pointer touch-manipulation"
        style={{ height: '68px' }}
        onClick={() => onExpandedChange(true)}
        role="button"
        aria-label="Expand player"
      >
        {/* Thin progress stripe at the very top */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-spotify-darkgray">
          <div className="h-full bg-spotify-green transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex items-center gap-3 px-4 h-full">
          {/* Album art thumbnail */}
          <div className="w-10 h-10 rounded overflow-hidden bg-spotify-darkgray flex-shrink-0">
            {track.albumArtUrl ? (
              <img src={track.albumArtUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg w-full h-full flex items-center justify-center select-none">🎵</span>
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{track.title}</p>
            <p className="text-xs text-spotify-lightgray truncate leading-tight">{track.artist}</p>
          </div>

          {/* Play / Pause */}
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay() }}
            className="w-11 h-11 bg-white rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation hover:scale-105 transition-transform"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); onNext() }}
            className="w-10 h-10 flex items-center justify-center flex-shrink-0 text-spotify-lightgray hover:text-white touch-manipulation"
            aria-label="Next"
          >
            <NextIcon />
          </button>
        </div>
      </div>

      {/* ── Mobile expanded full-screen sheet (below md) ── */}
      {mobileExpanded && (
        <div className="md:hidden fixed inset-0 z-50 bg-spotify-black overflow-hidden flex flex-col landscape:flex-row">

          {/* ── Portrait: Dismiss header ── */}
          <div className="flex items-center justify-between px-5 pt-safe landscape:hidden" style={{ minHeight: '56px' }}>
            <button
              onClick={() => onExpandedChange(false)}
              className="p-2 -ml-2 text-spotify-lightgray hover:text-white touch-manipulation"
              aria-label="Collapse player"
            >
              <ChevronDownIcon />
            </button>
            <span className="text-xs font-semibold uppercase tracking-widest text-spotify-lightgray">Now Playing</span>
            <div className="w-9" />
          </div>

          {/* ── Landscape: Left column — dismiss + album art ── */}
          <div className="hidden landscape:flex landscape:flex-col landscape:w-[45%] landscape:items-center landscape:justify-center landscape:px-6 landscape:py-4 landscape:pt-safe landscape:gap-3 flex-shrink-0">
            <button
              onClick={() => onExpandedChange(false)}
              className="self-start p-2 -ml-2 text-spotify-lightgray hover:text-white touch-manipulation"
              aria-label="Collapse player"
            >
              <ChevronDownIcon />
            </button>
            <div className="w-full max-w-[200px] aspect-square rounded-xl shadow-2xl overflow-hidden bg-spotify-gray flex items-center justify-center">
              {track.albumArtUrl ? (
                <img src={track.albumArtUrl} alt={track.album || track.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-6xl">🎵</span>
              )}
            </div>
          </div>

          {/* ── Portrait: Album art ── */}
          <div className="flex landscape:hidden items-center justify-center px-8 py-2 flex-shrink-0">
            <div className="w-full max-w-[300px] aspect-square rounded-2xl shadow-2xl overflow-hidden bg-spotify-gray flex items-center justify-center">
              {track.albumArtUrl ? (
                <img src={track.albumArtUrl} alt={track.album || track.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-8xl">🎵</span>
              )}
            </div>
          </div>

          {/* ── Controls column (portrait: bottom flex, landscape: right column) ── */}
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-6 py-4 landscape:justify-center landscape:pr-6 landscape:pt-safe">

            {/* Title + artist + rating */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white truncate landscape:text-lg">{track.title}</h2>
                <p className="text-spotify-lightgray truncate">{track.artist}</p>
                {track.album && (
                  <p className="text-spotify-lightgray text-sm truncate">{track.album}</p>
                )}
              </div>
              <div className="flex-shrink-0 -mr-2">
                <RatingButtons track={track} onRatingUpdate={onRatingUpdate} />
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2 text-xs text-spotify-lightgray mb-4">
              <span className="tabular-nums">{formatTime(currentTime)}</span>
              <div
                className="flex-1 h-1.5 bg-spotify-darkgray rounded-full cursor-pointer relative group"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-spotify-green rounded-full group-hover:bg-white transition-colors"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="tabular-nums">{formatTime(duration)}</span>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={onToggleShuffle}
                className={`p-3 touch-manipulation transition-colors ${shuffle ? 'text-spotify-green' : 'text-spotify-lightgray hover:text-white'}`}
                aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'}
              >
                <ShuffleIcon />
              </button>
              <button
                onClick={onPrev}
                className="p-3 touch-manipulation text-spotify-lightgray hover:text-white transition-colors"
                aria-label="Previous"
              >
                <PrevIconLg />
              </button>
              <button
                onClick={togglePlay}
                className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform touch-manipulation landscape:w-12 landscape:h-12"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <PauseIconLg /> : <PlayIconLg />}
              </button>
              <button
                onClick={onNext}
                className="p-3 touch-manipulation text-spotify-lightgray hover:text-white transition-colors"
                aria-label="Next"
              >
                <NextIconLg />
              </button>
              <button
                onClick={onToggleLoop}
                className={`p-3 touch-manipulation transition-colors ${loop ? 'text-spotify-green' : 'text-spotify-lightgray hover:text-white'}`}
                aria-label={loop ? 'Loop on' : 'Loop off'}
              >
                <LoopIcon />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3 pb-safe pb-4">
              <VolumeIcon />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 accent-spotify-green"
                aria-label="Volume"
              />
              <VolumeHighIcon />
            </div>
          </div>
        </div>
      )}
    </>
  )
}


function PlayIcon() {
  return (
    <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

function PrevIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  )
}

function NextIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg className="w-4 h-4 text-spotify-lightgray" fill="currentColor" viewBox="0 0 24 24">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  )
}

function ShuffleIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.41-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.5 10.5l-1.41 1.41 2.96 2.96L14.5 20H20v-5.5l-2.04 2.04L15 14.5z" />
    </svg>
  )
}

function LoopIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
    </svg>
  )
}

// ── Larger variants for the mobile expanded sheet ──

function PlayIconLg() {
  return (
    <svg className="w-7 h-7 text-black" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIconLg() {
  return (
    <svg className="w-7 h-7 text-black" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

function PrevIconLg() {
  return (
    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  )
}

function NextIconLg() {
  return (
    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function VolumeHighIcon() {
  return (
    <svg className="w-4 h-4 text-spotify-lightgray" fill="currentColor" viewBox="0 0 24 24">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  )
}

