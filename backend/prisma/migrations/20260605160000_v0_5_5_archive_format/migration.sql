-- Add archiveFormat field
ALTER TABLE "Backup" ADD COLUMN "archiveFormat" TEXT NOT NULL DEFAULT 'zip';

-- Migrate zipCompression values: "deflate" -> "default"
UPDATE "Backup" SET "zipCompression" = 'default' WHERE "zipCompression" = 'deflate';
-- "store" stays "store", already correct
