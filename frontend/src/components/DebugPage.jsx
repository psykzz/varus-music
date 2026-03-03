import { useState, useEffect } from 'react'
import { fetchDebugInfo } from '../services/api.js'

const TABS = [
  { id: 'popular', label: 'Global Popularity' },
  { id: 'rated', label: 'Your Ratings' },
  { id: 'unheard', label: 'Unheard' },
]

export default function DebugPage({ onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('popular')

  useEffect(() => {
    fetchDebugInfo()
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load debug info'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-spotify-black">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-spotify-darkgray border-b border-spotify-gray shrink-0">
        <div>
          <h2 className="text-lg font-bold text-white">Playlist Debug</h2>
          <p className="text-xs text-spotify-lightgray mt-0.5">How your playlist is generated</p>
        </div>
        <button
          onClick={onClose}
          className="text-spotify-lightgray hover:text-white transition-colors p-1"
          aria-label="Close debug page"
        >
          <CloseIcon />
        </button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-spotify-green" />
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {data && !loading && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Algorithm banner */}
          <AlgorithmBanner algorithm={data.algorithm} summary={data.summary} />

          {/* Tabs */}
          <div className="flex border-b border-spotify-gray bg-spotify-darkgray shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-spotify-lightgray hover:text-white'
                }`}
              >
                {tab.label}
                {tab.id === 'popular' && (
                  <span className="ml-1.5 text-xs text-spotify-lightgray">({data.summary.totalTracks})</span>
                )}
                {tab.id === 'rated' && (
                  <span className="ml-1.5 text-xs text-spotify-lightgray">({data.summary.ratedCount})</span>
                )}
                {tab.id === 'unheard' && (
                  <span className="ml-1.5 text-xs text-spotify-lightgray">({data.summary.unheardCount})</span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-spotify-green" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'popular' && <PopularList tracks={data.popularTracks} />}
            {activeTab === 'rated' && <RatedList tracks={data.ratedTracks} />}
            {activeTab === 'unheard' && <UnheardList tracks={data.unheardTracks} />}
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────── Algorithm banner ─────────────────────────── */

function AlgorithmBanner({ algorithm, summary }) {
  const isDiscovery = algorithm.mode === 'discovery'
  const progress = Math.min(
    100,
    Math.round((algorithm.userTotalRatings / algorithm.discoveryThreshold) * 100)
  )

  return (
    <div className={`px-6 py-4 border-b border-spotify-gray shrink-0 ${isDiscovery ? 'bg-blue-950/40' : 'bg-green-950/40'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isDiscovery ? 'bg-blue-700 text-blue-100' : 'bg-spotify-green text-black'
              }`}
            >
              {isDiscovery ? 'Discovery Mode' : 'Personalised Mode'}
            </span>
          </div>
          <p className="text-sm text-spotify-lightgray">{algorithm.description}</p>
          {isDiscovery && (
            <div className="mt-2 max-w-xs">
              <div className="flex justify-between text-xs text-spotify-lightgray mb-1">
                <span>{algorithm.userTotalRatings} rated</span>
                <span>{algorithm.discoveryThreshold} needed</span>
              </div>
              <div className="h-1.5 w-full bg-spotify-gray rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-4 text-center shrink-0">
          <Stat label="Total" value={summary.totalTracks} />
          <Stat label="Rated" value={summary.ratedCount} />
          <Stat label="Unheard" value={summary.unheardCount} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-spotify-lightgray">{label}</div>
    </div>
  )
}

/* ──────────────────────────── Popular list ─────────────────────────────── */

function PopularList({ tracks }) {
  if (tracks.length === 0) {
    return <EmptyMessage>No tracks in your library yet.</EmptyMessage>
  }

  const maxScore = tracks[0]?.popularityScore ?? 1

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-spotify-darkgray text-spotify-lightgray text-xs uppercase tracking-wider">
        <tr>
          <th className="text-left px-4 py-3 w-8">#</th>
          <th className="text-left px-4 py-3">Title / Artist</th>
          <th className="px-4 py-3 text-right whitespace-nowrap">Plays</th>
          <th className="px-4 py-3 text-right whitespace-nowrap">Global Score</th>
          <th className="px-4 py-3 text-right whitespace-nowrap">Popularity</th>
          <th className="px-4 py-3 w-32">Popularity Bar</th>
        </tr>
      </thead>
      <tbody>
        {tracks.map((track, i) => {
          const barWidth = maxScore > 0 ? Math.round((track.popularityScore / maxScore) * 100) : 0
          return (
            <tr key={track.id} className="border-t border-spotify-gray hover:bg-spotify-gray/30 transition-colors">
              <td className="px-4 py-3 text-spotify-lightgray">{i + 1}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-white truncate max-w-xs">{track.title}</div>
                <div className="text-spotify-lightgray text-xs truncate">{track.artist}{track.album ? ` · ${track.album}` : ''}</div>
              </td>
              <td className="px-4 py-3 text-right text-spotify-lightgray">{track.playCount}</td>
              <td className="px-4 py-3 text-right">
                <ScoreChip value={track.globalScore} />
              </td>
              <td className="px-4 py-3 text-right text-white font-medium">{track.popularityScore}</td>
              <td className="px-4 py-3">
                <div className="h-1.5 w-full bg-spotify-gray rounded-full overflow-hidden">
                  <div
                    className="h-full bg-spotify-green rounded-full"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ──────────────────────────── Rated list ───────────────────────────────── */

function RatedList({ tracks }) {
  if (tracks.length === 0) {
    return <EmptyMessage>You haven't rated any tracks yet. Like or dislike tracks while listening to get started.</EmptyMessage>
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-spotify-darkgray text-spotify-lightgray text-xs uppercase tracking-wider">
        <tr>
          <th className="text-left px-4 py-3 w-8">#</th>
          <th className="text-left px-4 py-3">Title / Artist</th>
          <th className="px-4 py-3 text-right whitespace-nowrap">Your Rating</th>
          <th className="px-4 py-3 text-right whitespace-nowrap">Global Score</th>
          <th className="px-4 py-3 text-right whitespace-nowrap">Plays</th>
        </tr>
      </thead>
      <tbody>
        {tracks.map((track, i) => (
          <tr key={track.id} className="border-t border-spotify-gray hover:bg-spotify-gray/30 transition-colors">
            <td className="px-4 py-3 text-spotify-lightgray">{i + 1}</td>
            <td className="px-4 py-3">
              <div className="font-medium text-white truncate max-w-xs">{track.title}</div>
              <div className="text-spotify-lightgray text-xs truncate">{track.artist}{track.album ? ` · ${track.album}` : ''}</div>
            </td>
            <td className="px-4 py-3 text-right">
              <UserRatingBadge value={track.userScore} />
            </td>
            <td className="px-4 py-3 text-right">
              <ScoreChip value={track.globalScore} />
            </td>
            <td className="px-4 py-3 text-right text-spotify-lightgray">{track.playCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ──────────────────────────── Unheard list ─────────────────────────────── */

function UnheardList({ tracks }) {
  if (tracks.length === 0) {
    return <EmptyMessage>You've rated every track in your library — impressive!</EmptyMessage>
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-spotify-darkgray text-spotify-lightgray text-xs uppercase tracking-wider">
        <tr>
          <th className="text-left px-4 py-3 w-8">#</th>
          <th className="text-left px-4 py-3">Title / Artist</th>
          <th className="px-4 py-3 text-right whitespace-nowrap">Global Score</th>
          <th className="px-4 py-3 text-right whitespace-nowrap">Plays</th>
          <th className="px-4 py-3 text-right whitespace-nowrap">Added</th>
        </tr>
      </thead>
      <tbody>
        {tracks.map((track, i) => (
          <tr key={track.id} className="border-t border-spotify-gray hover:bg-spotify-gray/30 transition-colors">
            <td className="px-4 py-3 text-spotify-lightgray">{i + 1}</td>
            <td className="px-4 py-3">
              <div className="font-medium text-white truncate max-w-xs">{track.title}</div>
              <div className="text-spotify-lightgray text-xs truncate">{track.artist}{track.album ? ` · ${track.album}` : ''}</div>
            </td>
            <td className="px-4 py-3 text-right">
              <ScoreChip value={track.globalScore} />
            </td>
            <td className="px-4 py-3 text-right text-spotify-lightgray">{track.playCount}</td>
            <td className="px-4 py-3 text-right text-spotify-lightgray text-xs">
              {track.year ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ──────────────────────────── Shared helpers ────────────────────────────── */

function ScoreChip({ value }) {
  const color =
    value > 0 ? 'text-spotify-green' : value < 0 ? 'text-red-400' : 'text-spotify-lightgray'
  const prefix = value > 0 ? '+' : ''
  return <span className={`font-medium ${color}`}>{prefix}{value}</span>
}

function UserRatingBadge({ value }) {
  if (value === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-spotify-green font-semibold">
        <ThumbIcon up /> Liked
      </span>
    )
  }
  if (value === -1) {
    return (
      <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
        <ThumbIcon /> Disliked
      </span>
    )
  }
  return <span className="text-spotify-lightgray">Neutral</span>
}

function ThumbIcon({ up = false }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={up ? {} : { transform: 'rotate(180deg)' }}>
      <path d="M2 20h2a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2H2v12zm18.83-7.12c.11-.25.17-.52.17-.88V10c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66a.996.996 0 0 0-.42-.42L13 2 7.59 7.41C7.21 7.79 7 8.3 7 8.83V18c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3-7.11z" />
    </svg>
  )
}

function EmptyMessage({ children }) {
  return (
    <div className="flex items-center justify-center h-48">
      <p className="text-spotify-lightgray text-sm text-center max-w-sm px-4">{children}</p>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
