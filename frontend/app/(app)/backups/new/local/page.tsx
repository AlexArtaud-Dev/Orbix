"use client";
import { useTranslation } from "react-i18next";
import { BackupWizard } from "@/components/backup/wizard/BackupWizard";

export default function NewLocalBackupPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("backups.newLocalTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("backups.newLocalSubtitle")}</p>
      </div>
      <BackupWizard mode="local" />
    </div>
  );
}
