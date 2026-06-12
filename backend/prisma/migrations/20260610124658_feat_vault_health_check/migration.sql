/*
  Warnings:

  - You are about to drop the column `smtpCheckedAt` on the `VaultEntity` table. All the data in the column will be lost.
  - You are about to drop the column `smtpStatus` on the `VaultEntity` table. All the data in the column will be lost.
  - You are about to drop the column `smtpStatusMsg` on the `VaultEntity` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "VaultEntity" DROP COLUMN "smtpCheckedAt",
DROP COLUMN "smtpStatus",
DROP COLUMN "smtpStatusMsg";

-- CreateTable
CREATE TABLE "VaultHealthCheck" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusMsg" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VaultHealthCheck_vaultId_key" ON "VaultHealthCheck"("vaultId");

-- AddForeignKey
ALTER TABLE "VaultHealthCheck" ADD CONSTRAINT "VaultHealthCheck_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "VaultEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
