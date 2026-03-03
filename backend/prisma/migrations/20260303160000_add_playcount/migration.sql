-- AlterTable: add playCount to Track for tracking full play-throughs (no skips)
ALTER TABLE "Track" ADD COLUMN "playCount" INTEGER NOT NULL DEFAULT 0;
