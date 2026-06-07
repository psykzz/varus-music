# Varus Music — Implementation Plan

## Context

Session date: 2026-06-06. Emerged from a domain grilling session that produced `CONTEXT.md` and
`docs/adr/0001-play-count-as-implicit-rating.md`. Three implementation gaps were identified:

1. **Per-user Net Play Count + Implicit Ratings** — the Play/Skip model is designed but not built
2. **Skip event tracking** — frontend fires play completions but never fires skips
3. **Onboarding Cadence selection** — the route only handles genres; Cadence is missing

---

## Phase 1 — Schema: Per-User Net Play Count & Implicit Rating flag

**Files:** `backend/prisma/schema.prisma`

Changes:
- Add `UserTrackStats` model: `id`, `userId`, `trackId`, `playCount Int @default(0)`, `skipCount Int @default(0)`
  with `@@unique([userId, trackId])` and cascade deletes from User and Track.
- Add `implicit Boolean @default(false)` to `Rating` model — distinguishes system-generated
  implicit Ratings from explicit user Ratings.
- Remove the now-redundant global `playCount` field from `Track` (it was never per-user and was inert).
- Run `npx prisma migrate dev --name per-user-net-play-count`.

---

## Phase 2 — Backend: Play/Skip routes + Implicit Rating logic

**Files:** `backend/src/routes/tracks.js`, new `backend/src/services/implicitRatingService.js`

### 2a. `implicitRatingService.js`

Extract a pure function `evaluateImplicitRating(userId, trackId)`:
1. Load `UserTrackStats` for this user+track.
2. Compute `net = playCount - skipCount`.
3. Check if an **explicit** (non-implicit) Rating already exists for this user+track — if so, return early (explicit always wins).
4. If `net >= 5`: upsert an implicit Like (`value: 1, implicit: true`).
5. If `net <= -5`: upsert an implicit Dislike (`value: -1, implicit: true`).
6. Otherwise: delete any existing implicit Rating for this user+track.

### 2b. Update `POST /api/tracks/:id/complete`

- Change from incrementing the global `Track.playCount` to upserting `UserTrackStats.playCount` for `req.user.sub`.
- Call `evaluateImplicitRating(userId, trackId)` after update.

### 2c. New `POST /api/tracks/:id/skip`

- Upsert `UserTrackStats.skipCount` for `req.user.sub`.
- Call `evaluateImplicitRating(userId, trackId)` after update.
- Return `{ id, net: playCount - skipCount }`.

### 2d. Ratings route guard

- Update `POST /api/ratings/:trackId` — when saving an explicit Rating, delete any existing implicit Rating for the same user+track first (explicit replaces implicit, not accumulates).

---

## Phase 3 — Frontend: Play/Skip threshold detection

**Files:** `frontend/src/components/Player.jsx`, `frontend/src/services/api.js`

### 3a. Play threshold (≥80%)

Currently `completeTrack()` is called only on `audio.ended` (100%). Change to:
- In the `timeupdate` handler, once `currentTime / duration >= 0.80` and `playFiredRef` is false,
  fire `completeTrack(track.id)` and set `playFiredRef = true`.
- Reset `playFiredRef` on track change.
- Keep the existing `audio.ended` handler for loop/next logic, but don't double-fire complete.

### 3b. Skip detection (<20% with 5s minimum)

- On track change (`useEffect` on `track?.id`), record `trackStartTimeRef = audio.currentTime` and
  `trackStartWallRef = Date.now()`.
- Before loading the new track (in `onNext` / `onPrev` / track-change), check:
  - `elapsed >= 5000ms` (wall clock since track loaded)
  - `currentTime / duration < 0.20`
  - `playFiredRef` is false (hasn't already been counted as a play)
  - If all true: fire `skipTrack(track.id)`.

### 3c. `api.js` — add `skipTrack`

```js
export async function skipTrack(trackId) {
  return handleResponse(
    await fetch(`${API_BASE}/tracks/${trackId}/skip`, {
      method: 'POST',
      headers: authHeaders(),
    })
  )
}
```

---

## Phase 4 — Onboarding: Cadence selection

**Files:** `backend/src/routes/onboarding.js`, `frontend/src/components/OnboardingModal.jsx`,
`frontend/src/services/api.js`

### 4a. Backend

Update `POST /api/onboarding/seed` body to accept `{ genres?: string[], cadence?: 'daily' | 'weekly' | 'monthly' }`.
After seeding, upsert a `CadenceSetting` for the user using the provided cadence (default: `'weekly'`).

### 4b. Frontend — OnboardingModal

Add a second step after genre selection: a Cadence picker (daily / weekly / monthly, default weekly).
Pass the chosen cadence to `seedForUser(genres, cadence)`.

### 4c. `api.js`

Update `seedForUser(genres, cadence)` to include cadence in the request body.

---

## Execution order

Phases must be done in order (each depends on the previous):
1 → 2 → 3 → 4 (Phase 4 is independent but logically last)

---

## Out of scope for this plan

- UI display of implicit vs explicit Ratings (could show a subtle indicator but not required now)
- Last.fm scrobbling (deliberately excluded — Last.fm is metadata/seeding only)
