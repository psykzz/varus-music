# Varus Music 🎵

A self-hosted music platform with automated playlist rotation, offline playback, and a Spotify-like UI.

## Features

- **Music Library** — Upload and manage MP3/WAV files
- **Rotation Engine** — Automated playlist cycles (daily / weekly / monthly) ranked by user ratings
- **Like / Dislike** — Rate tracks to influence the next generated playlist
- **Offline Support** — Service Worker caches audio files; IndexedDB stores playlist metadata
- **Spotify-like UI** — Play/Pause/Skip, progress bar, volume control, track list sidebar

## Project Structure

```
varus-music/
├── backend/          # Node.js + Fastify API
│   ├── prisma/       # Database schema (SQLite via Prisma)
│   └── src/
│       ├── routes/   # tracks, playlist, ratings, cadence
│       └── services/ # playlistService, schedulerService
└── frontend/         # React + Vite + Tailwind
    ├── public/
    │   └── sw.js     # Service Worker (offline playback)
    └── src/
        ├── components/  # Player, TrackList, RatingButtons, CadenceSelector
        └── services/    # api.js, offlineCache.js (IndexedDB)
```

## Quick Start

### Docker Compose (recommended)

**1. Create a `.env` file in the project root:**

```env
# PostgreSQL
POSTGRES_PASSWORD=change_me

# Auth
JWT_SECRET=change_me_to_a_long_random_string

# Last.fm — required for scrobbling / metadata enrichment
# Get a free API key at https://www.last.fm/api/account/create
LASTFM_API_KEY=your_lastfm_api_key_here

# Storage paths (defaults to ./storage/* if not set)
# MUSIC_PATH=/mnt/nas/music
# WATCH_PATH=/mnt/nas/watch

# Ports (optional overrides)
# BACKEND_PORT=3001
# FRONTEND_PORT=80

# Image tags (optional — defaults to latest from GHCR)
# BACKEND_IMAGE=ghcr.io/psykzz/varus-music-backend:latest
# FRONTEND_IMAGE=ghcr.io/psykzz/varus-music-frontend:latest
```

**2. Pull and start all services:**

```bash
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

**3. Other useful commands:**

```bash
# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend

# Stop all services
docker compose down

# Stop and remove volumes (⚠️ deletes database)
docker compose down -v

# Restart a single service after an update
docker compose pull backend
docker compose up -d --no-deps backend
```

Open http://localhost in your browser (or whichever port `FRONTEND_PORT` is set to).

---

### Local Development

#### Prerequisites

- Node.js 18+
- npm 9+

#### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate   # creates SQLite DB and runs migrations
npm run dev          # starts on http://localhost:3001
```

#### Frontend

```bash
cd frontend
npm install
npm run dev          # starts on http://localhost:5173
```

Open http://localhost:5173 in your browser. The frontend proxies `/api` and `/files` to the backend.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tracks` | List all tracks with scores |
| POST | `/api/tracks/upload` | Upload MP3/WAV (multipart form) |
| DELETE | `/api/tracks/:id` | Delete a track |
| GET | `/api/playlist/current` | Get the active playlist cycle |
| POST | `/api/playlist/refresh` | Manually trigger a new cycle |
| POST | `/api/ratings/:trackId` | Rate a track (`{ value: 1 | 0 | -1 }`) |
| GET | `/api/cadence` | Get current cadence setting |
| PUT | `/api/cadence` | Update cadence (`{ interval: "daily" | "weekly" | "monthly" }`) |

## Database Schema

```
Track            — id, title, artist, album, filename, duration, mimeType
Rating           — id, trackId, value (+1/-1/0)
CadenceSetting   — id, interval, lastRun, nextRun
PlaylistCycle    — id, startedAt, expiresAt, active
PlaylistCycleTrack — cycleId, trackId, position
```

## Offline Strategy

- **Audio files** (`/files/*`): Cache-first via Service Worker — pre-cached when a playlist loads
- **API calls** (`/api/*`): Network-first — falls back to cache when offline
- **Static assets**: Stale-while-revalidate
- **Playlist metadata**: Stored in IndexedDB for offline access

## Rotation Mechanic

The cadence scheduler runs hourly. When `nextRun` expires:
1. The current playlist cycle is deactivated
2. A new cycle is generated: unrated tracks first (discovery), then ranked by cumulative score
3. Tracks with score ≤ −3 are excluded from the new cycle
