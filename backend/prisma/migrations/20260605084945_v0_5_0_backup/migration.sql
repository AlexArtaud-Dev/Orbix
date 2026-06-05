-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '{"sources":[]}',
    "scheduleType" TEXT NOT NULL DEFAULT 'manual',
    "scheduleConfig" JSONB,
    "schedule" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "zipCompression" TEXT NOT NULL DEFAULT 'deflate',
    "zipPassword" TEXT,
    "zipFilename" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "validationStatus" TEXT,
    "validationError" TEXT,
    "validatedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupOutput" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "templateId" TEXT,
    "recipientsTo" TEXT[],
    "recipientsCc" TEXT[],
    "recipientsBcc" TEXT[],
    "overrideSubject" TEXT,
    "overrideBody" TEXT,
    "overrideBodyType" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Backup_name_key" ON "Backup"("name");

-- AddForeignKey
ALTER TABLE "BackupOutput" ADD CONSTRAINT "BackupOutput_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "Backup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
