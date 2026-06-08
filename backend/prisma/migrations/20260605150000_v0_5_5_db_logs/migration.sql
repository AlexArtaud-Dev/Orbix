-- CreateTable: Log (replaces file-based logs)
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "msg" TEXT NOT NULL,
    "detail" TEXT,
    "backupId" TEXT,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: optimised for the most common query patterns
CREATE INDEX "Log_ts_idx" ON "Log"("ts" DESC);
CREATE INDEX "Log_level_ts_idx" ON "Log"("level", "ts" DESC);
CREATE INDEX "Log_category_ts_idx" ON "Log"("category", "ts" DESC);
CREATE INDEX "Log_backupId_ts_idx" ON "Log"("backupId", "ts" DESC);

-- AlterTable: replace logRetentionDays with logRetentionHours
ALTER TABLE "SystemSettings" ADD COLUMN "logRetentionHours" INTEGER NOT NULL DEFAULT 720;
UPDATE "SystemSettings" SET "logRetentionHours" = "logRetentionDays" * 24;
ALTER TABLE "SystemSettings" DROP COLUMN "logRetentionDays";
