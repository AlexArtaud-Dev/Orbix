-- CreateTable
CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "archiveSizeBytes" INTEGER,
    "filesCount" INTEGER,
    "errorMessage" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupRun_backupId_startedAt_idx" ON "BackupRun"("backupId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "BackupRun_startedAt_idx" ON "BackupRun"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "BackupRun_status_startedAt_idx" ON "BackupRun"("status", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "BackupRun" ADD CONSTRAINT "BackupRun_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "Backup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
