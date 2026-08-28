-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'READY');

-- AlterTable
ALTER TABLE "File" ADD COLUMN "status" "FileStatus" NOT NULL DEFAULT 'PENDING';

-- Rows that predate the confirmation step were only ever created after an
-- upload-url request, with no way to tell which ones actually landed in S3.
-- Treat them as READY so existing libraries stay visible.
UPDATE "File" SET "status" = 'READY';

-- DropIndex
DROP INDEX "File_ownerId_idx";

-- CreateIndex
CREATE INDEX "File_ownerId_status_idx" ON "File"("ownerId", "status");
