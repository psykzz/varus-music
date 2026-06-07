# Varus Music

A self-hosted music platform for household use, with automated playlist rotation, offline playback, and per-user personalised track recommendations. The Track library is shared; Ratings, Cycles, and Cadences are personal.

## Language

**Track**:
An audio file and its associated metadata (title, artist, album, duration, etc.).
_Avoid_: Song, file, audio

**Cycle** (PlaylistCycle in code):
A time-bounded period during which an ordered list of Tracks is active for a user. When the period expires, a Rotation produces a new Cycle. A Cycle implicitly contains its ordered Track list — the two are not modelled separately.
_Avoid_: Playlist (too generic; implies static, manually-curated)

**Rotation**:
The domain event of ending the current active Cycle and generating a new one. Triggered automatically by the Cadence scheduler or manually by the user.
_Avoid_: Refresh (UI label only)

**Cadence**:
A user's configured rotation schedule: the interval (daily / weekly / monthly) plus the timing state (last run, next run). Determines when the next automatic Rotation occurs.
_Avoid_: Interval, schedule, frequency

**Rating**:
A user's discrete reaction to a Track: Like (+1), Dislike (−1), or Neutral (0). Neutral means "heard and feel nothing" and is distinct from Unrated (no Rating record exists). Ratings influence Cycle generation.
_Avoid_: Reaction, vote, score

**Discovery** (mode):
The Cycle generation mode for new users with fewer than 5 Ratings. Surfaces globally popular Tracks and random unrated Tracks to help the user build their taste profile.
_Avoid_: Onboarding mode, new user mode

**Personalised** (mode):
The Cycle generation mode for users with 5 or more Ratings. Surfaces the user's liked Tracks (up to 50% of the Cycle) plus random filler from unrated and neutral-rated Tracks.
_Avoid_: Custom mode, recommendation mode

**Seeding**:
The automated process of discovering new Track candidates from Last.fm, finding them on YouTube, and downloading them into the library. Triggered after every Rotation. In Discovery mode, pulls from the global chart; in Personalised mode, pulls similar tracks for the user's top liked artists.
_Avoid_: Auto-download, enrichment, importing

**Play Count**:
The number of times a Track has been played to natural completion (i.e. not skipped) by any user. Acts as an implicit Rating signal: once a Track's play count crosses a threshold, it is treated as a soft like in the Cycle generation algorithm.
_Avoid_: Listen count, stream count

**Play**:
A listening event counted when a User hears ≥80% of a Track's duration. Contributes +1 to that User's Net Play Count for the Track.
_Avoid_: Listen, stream, completion

**Skip**:
A listening event counted when a User changes track before 20% of its duration, provided at least 5 seconds have elapsed. Contributes −1 to that User's Net Play Count for the Track. Listening between 20–80% generates no signal.
_Avoid_: Pass, next, dismiss

**Net Play Count**:
The per-User, per-Track running total of Plays minus Skips. When it reaches +5 an implicit Like Rating is applied and held for as long as the count remains ≥ +5. When it reaches −5 an implicit Dislike Rating is applied and held for as long as the count remains ≤ −5.
_Avoid_: Score, engagement score

**Track Acquisition** (DownloadJob in code):
The process of obtaining a Track from an external source (YouTube via yt-dlp). Produces a Download Job that progresses through pending → downloading → done | error states. Triggered either manually by a user or automatically via Seeding.
_Avoid_: Download, import, fetch

**File Purge**:
The automatic deletion of a Track's audio file from disk when the Track is no longer in any active Cycle. The Track record and metadata are retained. The audio can be re-acquired via Track Acquisition using the stored source URL.
_Avoid_: Archive, cleanup, eviction

**Onboarding**:
The one-time setup flow a new User completes before their first Cycle is generated. The User selects genre preferences and their Cadence; the system queues initial Track Acquisitions for the chosen genres. Guarded by the `onboardingComplete` flag — cannot be repeated.
_Avoid_: Registration, setup, configuration

**User**:
A household member with their own Rating history, Cadence, and active Cycle. The Track library is shared across all Users; personalisation is per-User.
_Avoid_: Account, profile, member

**Ingestion**:
The process of adding a Track to the shared library, regardless of source (manual upload, Track Acquisition, or Watch Folder drop). Copies the audio file to storage, creates a Track record, and triggers Enrichment.
_Avoid_: Import, upload, add

**Watch Folder**:
A monitored directory on the host. Any audio file dropped into it is automatically Ingested.
_Avoid_: Drop folder, import folder

**Enrichment**:
The asynchronous process of fetching additional Track metadata (album art, genre, year, Last.fm URL) from Last.fm after Ingestion.
_Avoid_: Metadata fetch, tagging
