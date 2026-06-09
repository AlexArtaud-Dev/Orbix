-- Add zipPasswordVaultRef: allows referencing a vault variable set key as zip password
ALTER TABLE "Backup" ADD COLUMN "zipPasswordVaultRef" TEXT;
