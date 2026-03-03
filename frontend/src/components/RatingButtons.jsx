import { useState } from 'react'
import { rateTrack } from '../services/api.js'

export default function RatingButtons({ track, onRatingUpdate, size = 'md' }) {
  const [submitting, setSubmitting] = useState(false)
  const [lastRating, setLastRating] = useState(null)

  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  const buttonClass = size === 'sm' ? 'p-1' : 'p-1.5'

  async function handleRate(value) {
    if (submitting) return
    // Re-clicking the active vote keeps it (no-op)
    if (value === lastRating) return
    setSubmitting(true)
    try {
      await rateTrack(track.id, value)
      setLastRating(value)
      onRatingUpdate(track.id, value)
    } catch (err) {
      console.error('Failed to rate track:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => handleRate(1)}
        disabled={submitting}
        className={`${buttonClass} rounded transition-colors ${
          lastRating === 1
            ? 'text-spotify-green'
            : 'text-spotify-lightgray hover:text-spotify-green'
        } disabled:opacity-50`}
        aria-label="Like"
        title="Like"
      >
        <ThumbUpIcon className={iconClass} />
      </button>
      <button
        onClick={() => handleRate(-1)}
        disabled={submitting}
        className={`${buttonClass} rounded transition-colors ${
          lastRating === -1
            ? 'text-red-400'
            : 'text-spotify-lightgray hover:text-red-400'
        } disabled:opacity-50`}
        aria-label="Dislike"
        title="Dislike"
      >
        <ThumbDownIcon className={iconClass} />
      </button>
    </div>
  )
}

function ThumbUpIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  )
}

function ThumbDownIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
    </svg>
  )
}
