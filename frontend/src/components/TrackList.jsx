import RatingButtons from './RatingButtons.jsx'

export default function TrackList({ tracks, currentIndex, onSelect, onRatingUpdate, onSeedLibrary, seeding, newTrackIds = new Set(), cacheProgress = null }) {
  if (!tracks.length) {
    return (
      <div className="p-6 text-center mt-6 flex flex-col gap-3">
        <p className="text-spotify-lightgray text-sm">No tracks in this cycle</p>
        {onSeedLibrary && (
          <button
            onClick={onSeedLibrary}
            disabled={seeding}
            className="w-full py-2 px-3 bg-spotify-green text-black text-xs font-bold rounded-full hover:bg-green-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {seeding ? (
              <>
                <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-black inline-block" />
                Queuing…
              </>
            ) : (
              'Seed with popular tracks'
            )}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="py-2">
      <div className="px-4 pt-2 pb-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-spotify-lightgray shrink-0">
            Current Cycle
          </h2>
          {cacheProgress && (
            <div className="flex items-center gap-1.5 text-xs">
              {!cacheProgress.done ? (
                <span className="animate-spin rounded-full h-2.5 w-2.5 border-t-2 border-spotify-green shrink-0" />
              ) : (
                <span className="text-spotify-green shrink-0">✓</span>
              )}
              <span className={cacheProgress.done ? 'text-spotify-green' : 'text-spotify-lightgray'}>
                {cacheProgress.cached} / {cacheProgress.total} downloaded
              </span>
              {cacheProgress.failed > 0 && (
                <span className="text-orange-400">· {cacheProgress.failed} failed</span>
              )}
            </div>
          )}
        </div>
        {cacheProgress && !cacheProgress.done && cacheProgress.total > 0 && (
          <div className="mt-1.5 h-0.5 bg-spotify-gray rounded-full overflow-hidden">
            <div
              className="h-full bg-spotify-green rounded-full transition-all duration-300"
              style={{ width: `${Math.round((cacheProgress.cached / cacheProgress.total) * 100)}%` }}
            />
          </div>
        )}
      </div>
      {tracks.map((track, index) => (
        <div
          key={track.id}
          onClick={() => onSelect(index)}
          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-spotify-gray transition-colors ${
            index === currentIndex ? 'bg-spotify-gray' : ''
          }`}
        >
          {/* Track number / playing indicator */}
          <div className="w-5 text-center text-xs text-spotify-lightgray flex-shrink-0">
            {index === currentIndex ? (
              <span className="text-spotify-green">▶</span>
            ) : (
              <span>{index + 1}</span>
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  index === currentIndex ? 'text-spotify-green' : 'text-white'
                }`}
              >
                {track.title}
              </p>
              {newTrackIds.has(String(track.id)) && (
                <span className="flex-shrink-0 bg-spotify-green text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase leading-none">
                  new
                </span>
              )}
            </div>
            <p className="text-xs text-spotify-lightgray truncate">{track.artist}</p>
          </div>

          {/* Score badge */}
          {track.score !== undefined && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                track.score > 0
                  ? 'bg-green-900 text-green-300'
                  : track.score < 0
                  ? 'bg-red-900 text-red-300'
                  : 'bg-spotify-gray text-spotify-lightgray'
              }`}
            >
              {track.score > 0 ? '+' : ''}
              {track.score}
            </span>
          )}

          {/* Rating buttons */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          >
            <RatingButtons track={track} onRatingUpdate={onRatingUpdate} size="sm" />
          </div>
        </div>
      ))}
    </div>
  )
}