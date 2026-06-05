"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { backupsService, type Backup, type CreateBackupPayload } from "@/services/backups";
import { ApiError } from "@/lib/api";
import { BackupForm } from "@/components/backup/BackupForm";

export default function EditBackupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [backup, setBackup] = useState<Backup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (payload: CreateBackupPayload) => {
    if (!payload.name) {
      toast.error(t("backups.errorNoName"));
      return;
    }
    if (payload.sources.paths.length === 0) {
      toast.error(t("backups.errorNoSources"));
      return;
    }
    setSaving(true);
    try {
      await backupsService.update(id, payload);
      toast.success(t("backups.updateSuccess"));
      router.push("/backups");
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!backup) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("backups.editTitle")}</h1>
        <p className="text-muted-foreground font-mono text-sm">{backup.name}</p>
      </div>
      <BackupForm
        initial={backup}
        saving={saving}
        onSubmit={(payload) => void handleSubmit(payload)}
        onCancel={() => router.back()}
      />
    </div>
  );
}
