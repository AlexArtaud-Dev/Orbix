"use client";
import { useTranslation } from "react-i18next";
import { BackupWizard } from "@/components/backup/wizard/BackupWizard";

export default function NewBackupPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("backups.newTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("backups.newSubtitle")}</p>
      </div>
      <BackupWizard />
    </div>
  );
}
