-- CreateTable
CREATE TABLE "SshOutputConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "destPath" TEXT NOT NULL,
    "lastTestStatus" TEXT,
    "lastTestError" TEXT,
    "lastTestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SshOutputConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SshOutputConfig_name_key" ON "SshOutputConfig"("name");
