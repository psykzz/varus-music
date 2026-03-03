import RatingButtons from './RatingButtons.jsx'

export default function TrackList({ tracks, currentIndex, onSelect, onRatingUpdate, onSeedLibrary, seeding }) {
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
      <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-spotify-lightgray">
        Current Cycle
      </h2>
      {tracks.map((track, index) => (
        <div
          key={track.id}
          onClick={() => onSelect(index)}
          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-spotify-gray transition-colors ${
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
            <p
              className={`text-sm font-medium truncate ${
                index === currentIndex ? 'text-spotify-green' : 'text-white'
              }`}
            >
              {track.title}
            </p>
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
