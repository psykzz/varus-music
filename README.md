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

### Prerequisites

- Node.js 18+
- npm 9+

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate   # creates SQLite DB and runs migrations
npm run dev          # starts on http://localhost:3001
```

### Frontend

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
