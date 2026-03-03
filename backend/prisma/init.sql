-- Varus Music — initial schema
-- Runs on startup only when tables do not yet exist.
-- Generated from prisma/schema.prisma — keep in sync when the schema changes.

CREATE TABLE IF NOT EXISTS "User" (
  "id"                 TEXT         NOT NULL,
  "username"           TEXT         NOT NULL,
  "passwordHash"       TEXT         NOT NULL,
  "onboardingComplete" BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

CREATE TABLE IF NOT EXISTS "Track" (
  "id"          TEXT         NOT NULL,
  "title"       TEXT         NOT NULL,
  "artist"      TEXT         NOT NULL,
  "album"       TEXT,
  "filename"    TEXT         NOT NULL,
  "duration"    INTEGER,
  "mimeType"    TEXT         NOT NULL DEFAULT 'audio/mpeg',
  "albumArtUrl" TEXT,
  "genre"       TEXT,
  "year"        INTEGER,
  "lastfmUrl"   TEXT,
  "playCount"   INTEGER      NOT NULL DEFAULT 0,
  "filePurged"  BOOLEAN      NOT NULL DEFAULT false,
  "sourceUrl"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Track_filename_key" ON "Track"("filename");

CREATE TABLE IF NOT EXISTS "Rating" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "trackId"   TEXT         NOT NULL,
  "value"     INTEGER      NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Rating_pkey"    PRIMARY KEY ("id"),
  CONSTRAINT "Rating_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id")  ON DELETE CASCADE,
  CONSTRAINT "Rating_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Rating_userId_trackId_key" ON "Rating"("userId", "trackId");

CREATE TABLE IF NOT EXISTS "CadenceSetting" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "interval"  TEXT         NOT NULL DEFAULT 'weekly',
  "lastRun"   TIMESTAMP(3),
  "nextRun"   TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CadenceSetting_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "CadenceSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CadenceSetting_userId_key" ON "CadenceSetting"("userId");

CREATE TABLE IF NOT EXISTS "PlaylistCycle" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "active"    BOOLEAN      NOT NULL DEFAULT true,
  CONSTRAINT "PlaylistCycle_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "PlaylistCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlaylistCycleTrack" (
  "id"       TEXT    NOT NULL,
  "cycleId"  TEXT    NOT NULL,
  "trackId"  TEXT    NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "PlaylistCycleTrack_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "PlaylistCycleTrack_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PlaylistCycle"("id") ON DELETE CASCADE,
  CONSTRAINT "PlaylistCycleTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id")         ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlaylistCycleTrack_cycleId_trackId_key"  ON "PlaylistCycleTrack"("cycleId", "trackId");
CREATE UNIQUE INDEX IF NOT EXISTS "PlaylistCycleTrack_cycleId_position_key" ON "PlaylistCycleTrack"("cycleId", "position");

CREATE TABLE IF NOT EXISTS "DownloadJob" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "url"       TEXT         NOT NULL,
  "title"     TEXT,
  "artist"    TEXT,
  "status"    TEXT         NOT NULL DEFAULT 'pending',
  "error"     TEXT,
  "trackId"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DownloadJob_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "DownloadJob_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id")  ON DELETE CASCADE,
  CONSTRAINT "DownloadJob_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id")
);

-- Idempotent column additions for upgrading existing databases
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "filePurged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "sourceUrl"  TEXT;
