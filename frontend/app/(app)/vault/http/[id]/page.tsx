"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { vaultService, type HttpVaultItem } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SkeletonForm } from "@/components/ui/skeleton";
import {
  HttpVaultForm,
  formToData,
  type HttpVaultFormData,
} from "@/components/vault/HttpVaultForm";

export default function EditHttpVaultPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [item, setItem] = useState<HttpVaultItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<HttpVaultFormData>({ name: "", subtype: "", entries: [] });

  useEffect(() => {
    vaultService.getHttp(id).then((data) => {
      setItem(data);
      setForm({ name: data.name, subtype: data.subtype, entries: [] });
    });
  }, [id]);

  const onChange = <K extends keyof HttpVaultFormData>(key: K, value: HttpVaultFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = formToData(form);
      const hasSecretData = Object.values(data).some((v) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0));
      await vaultService.updateHttp(id, {
        name: form.name,
        data: hasSecretData ? data : undefined,
      });
      toast.success(t("vault.http.updateSuccess"));
      router.push("/vault/http");
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (!item) return <SkeletonForm />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("vault.http.editTitle")}</h1>
        <p className="text-muted-foreground">{t("vault.http.editSubtitle")}</p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <HttpVaultForm form={form} onChange={onChange} subtypeLocked isEdit />

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
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
