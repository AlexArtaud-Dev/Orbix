-- Add configurable SMTP health-check interval (in minutes)
ALTER TABLE "SystemSettings"
  ADD COLUMN "smtpHealthCheckIntervalMinutes" INTEGER NOT NULL DEFAULT 5;
