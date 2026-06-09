-- CreateTable: Input
CREATE TABLE "Input" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "vaultId"        TEXT,
    "config"         JSONB NOT NULL DEFAULT '{}',
    "requestParams"  JSONB NOT NULL DEFAULT '[]',
    "enabled"        BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt"     TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestError"  TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Input_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Input_name_key" ON "Input"("name");
