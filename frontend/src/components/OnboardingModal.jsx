import { useState, useEffect } from 'react'
import { fetchGenres, seedForUser } from '../services/api.js'
import { refreshPlaylist } from '../services/api.js'

const GENRE_ICONS = {
  pop: '🎤',
  rock: '🎸',
  'hip-hop': '🎧',
  electronic: '🎛️',
  classical: '🎻',
  indie: '🌿',
  jazz: '🎷',
  'r&b': '🎹',
}

export default function OnboardingModal({ onComplete }) {
  const [genres, setGenres] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [status, setStatus] = useState('idle') // idle | loading | seeding | done

  useEffect(() => {
    fetchGenres()
      .then((data) => setGenres(data.genres ?? []))
      .catch(() => {
        // Fallback list if network fails before auth
        setGenres(['pop', 'rock', 'hip-hop', 'electronic', 'classical', 'indie', 'jazz', 'r&b'])
      })
  }, [])

  function toggleGenre(genre) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(genre) ? next.delete(genre) : next.add(genre)
      return next
    })
  }

  async function handleStart(chosenGenres) {
    setStatus('seeding')
    try {
      await seedForUser(chosenGenres)
      await refreshPlaylist()
    } catch (err) {
      console.error('[Onboarding] Seeding failed:', err)
      // Even on failure, proceed — library may already have tracks
    }
    setStatus('done')
    onComplete()
  }

  if (status === 'seeding') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-spotify-darkgray rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-spotify-green mx-auto mb-6" />
          <h2 className="text-white text-xl font-bold mb-2">Building your library…</h2>
          <p className="text-spotify-lightgray text-sm">
            We're queuing popular tracks for you. Music will appear as downloads complete.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-spotify-darkgray rounded-2xl p-8 max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl block mb-4">🎵</span>
          <h2 className="text-white text-2xl font-bold">Welcome to Varus Music</h2>
          <p className="text-spotify-lightgray mt-2 text-sm">
            Pick a few genres you enjoy and we'll seed your library with popular tracks.
            Rate them to personalise your rotation over time.
          </p>
        </div>

        {/* Genre grid */}
        {genres.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {genres.map((genre) => {
              const isSelected = selected.has(genre)
              return (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={[
                    'flex flex-col items-center justify-center gap-1 py-4 rounded-xl border-2 transition-all text-sm font-medium capitalize',
                    isSelected
                      ? 'border-spotify-green bg-spotify-green/10 text-spotify-green'
                      : 'border-spotify-gray text-spotify-lightgray hover:border-white hover:text-white',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  <span className="text-2xl">{GENRE_ICONS[genre] ?? '🎵'}</span>
                  {genre}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex justify-center mb-8">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-spotify-green" />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleStart([...selected])}
            disabled={status !== 'idle'}
            className="w-full py-3 bg-spotify-green text-black font-bold rounded-full hover:bg-green-400 transition-colors disabled:opacity-50"
          >
            {selected.size === 0 ? 'Start Discovering' : `Start with ${selected.size} genre${selected.size > 1 ? 's' : ''}`}
          </button>
          <button
            onClick={() => handleStart([])}
            className="w-full py-2 text-spotify-lightgray hover:text-white text-sm transition-colors"
          >
            Skip — seed a bit of everything
          </button>
        </div>
      </div>
    </div>
  )
}
