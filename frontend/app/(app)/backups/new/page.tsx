"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { backupsService, type CreateBackupPayload } from "@/services/backups";
import { ApiError } from "@/lib/api";
import { BackupForm } from "@/components/backup/BackupForm";

export default function NewBackupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

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
      await backupsService.create(payload);
      toast.success(t("backups.createSuccess"));
      router.push("/backups");
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("backups.newTitle")}</h1>
      </div>
      <BackupForm
        saving={saving}
        onSubmit={(payload) => void handleSubmit(payload)}
        onCancel={() => router.back()}
      />
    </div>
  );
}
