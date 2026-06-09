-- v0.7.0: add backup size limits to SystemSettings
ALTER TABLE "SystemSettings" ADD COLUMN "maxSourceFileSizeMb" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "SystemSettings" ADD COLUMN "maxBackupTotalSizeMb" INTEGER NOT NULL DEFAULT 2000;
