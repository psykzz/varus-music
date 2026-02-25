import { useEffect, useRef, useState } from 'react'
import RatingButtons from './RatingButtons.jsx'

export default function Player({ track, onNext, onPrev, onRatingUpdate }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  // When track changes, reset and autoplay
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load()
      setCurrentTime(0)
      setDuration(0)
      if (isPlayingRef.current) {
        audioRef.current.play().catch(() => { setIsPlaying(false); isPlayingRef.current = false })
      }
    }
  }, [track?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => setDuration(audio.duration || 0)
    const handleEnded = () => onNext()

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [onNext])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (isPlayingRef.current) {
      audio.pause()
      setIsPlaying(false)
      isPlayingRef.current = false
    } else {
      audio.play().then(() => { setIsPlaying(true); isPlayingRef.current = true }).catch(() => { setIsPlaying(false); isPlayingRef.current = false })
    }
  }

  function handleSeek(e) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * duration
  }

  function handleVolumeChange(e) {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col px-6 py-3 gap-2">
      <audio
        ref={audioRef}
        src={`/files/${track.filename}`}
        onPlay={() => { setIsPlaying(true); isPlayingRef.current = true }}
        onPause={() => { setIsPlaying(false); isPlayingRef.current = false }}
        preload="metadata"
      />

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
            onClick={onPrev}
            className="text-spotify-lightgray hover:text-white transition-colors"
            aria-label="Previous"
          >
            <PrevIcon />
          </button>
          <button
            onClick={togglePlay}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
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
