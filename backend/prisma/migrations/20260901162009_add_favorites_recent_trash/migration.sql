-- AlterTable
ALTER TABLE "File" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAccessedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "File_ownerId_deletedAt_idx" ON "File"("ownerId", "deletedAt");

-- CreateIndex
CREATE INDEX "File_ownerId_isFavorite_deletedAt_idx" ON "File"("ownerId", "isFavorite", "deletedAt");

-- CreateIndex
CREATE INDEX "File_deletedAt_idx" ON "File"("deletedAt");
