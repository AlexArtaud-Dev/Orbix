-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultEntity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "smtpStatus" TEXT,
    "smtpStatusMsg" TEXT,
    "smtpCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "maxFileSizeMb" INTEGER NOT NULL DEFAULT 500,
    "logRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "backupRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "defaultTheme" TEXT NOT NULL DEFAULT 'dark',

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "VaultEntity_name_key" ON "VaultEntity"("name");
