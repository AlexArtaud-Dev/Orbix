-- Migration v0.7.0 — add backupType field to Backup
ALTER TABLE "Backup" ADD COLUMN "backupType" TEXT NOT NULL DEFAULT 'local';
