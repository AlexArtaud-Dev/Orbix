"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { vaultService } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  HttpVaultForm,
  defaultHttpVaultForm,
  formToData,
  type HttpVaultFormData,
} from "@/components/vault/HttpVaultForm";
import type { HttpVaultSubtype } from "@/services/vault";

export default function NewHttpVaultPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<HttpVaultFormData>(defaultHttpVaultForm);

  const onChange = <K extends keyof HttpVaultFormData>(key: K, value: HttpVaultFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subtype) {
      toast.error(t("vault.http.subtypePlaceholder"));
      return;
    }
    setSaving(true);
    try {
      await vaultService.createHttp({
        name: form.name,
        subtype: form.subtype as HttpVaultSubtype,
        data: formToData(form),
      });
      toast.success(t("vault.http.createSuccess"));
      router.push("/vault/http");
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("vault.http.newTitle")}</h1>
        <p className="text-muted-foreground">{t("vault.http.newSubtitle")}</p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <HttpVaultForm form={form} onChange={onChange} />

        <div className="flex gap-3">
          <Button type="submit" disabled={saving || !form.subtype}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
