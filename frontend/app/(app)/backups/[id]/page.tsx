"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { backupsService, type Backup } from "@/services/backups";
import { BackupWizard } from "@/components/backup/wizard/BackupWizard";
import { SkeletonForm } from "@/components/ui/skeleton";

export default function EditBackupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [backup, setBackup] = useState<Backup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await backupsService.getOne(id);
        setBackup(data);
      } catch {
        toast.error(t("common.error"));
        router.push("/backups");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]); // eslint-disable-line

  if (loading) {
    return (
      <div className="max-w-4xl">
        <SkeletonForm blocks={3} />
      </div>
    );
  }

  if (!backup) return null;

  // Read persisted mode; fall back to source inference for legacy backups
  const mode: "local" | "input" =
    backup.backupType === "input" ||
    backup.sources.sources.some((s) => s.type === "input")
      ? "input"
      : "local";

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("backups.editTitle")}</h1>
        <p className="font-mono text-sm text-muted-foreground">{backup.name}</p>
      </div>
      <BackupWizard mode={mode} initial={backup} />
    </div>
  );
}
