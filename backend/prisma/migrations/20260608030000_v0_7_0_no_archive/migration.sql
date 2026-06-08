-- AlterTable: add noArchive column to Backup
ALTER TABLE "Backup" ADD COLUMN "noArchive" BOOLEAN NOT NULL DEFAULT false;
