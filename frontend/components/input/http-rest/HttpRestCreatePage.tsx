"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { inputService } from "@/services/input";
import { vaultService, type HttpVaultItem, type VarSetItem } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  HttpRestInputForm,
  defaultHttpRestInputForm,
  formToPayload,
  type HttpRestInputFormData,
} from "@/components/input/HttpRestInputForm";

interface Props {
  /** Provider type — determines the success redirect URL. */
  type: string;
}

export function HttpRestCreatePage({ type }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<HttpRestInputFormData>(defaultHttpRestInputForm());
  const [httpVaultItems, setHttpVaultItems] = useState<HttpVaultItem[]>([]);
  const [varSetItems, setVarSetItems] = useState<VarSetItem[]>([]);
  const [isFormValid, setIsFormValid] = useState(true);

  useEffect(() => {
    vaultService.listHttp(undefined, 100).then((res) => setHttpVaultItems(res.data)).catch(() => null);
    vaultService.listVarSet(undefined, 100).then((res) => setVarSetItems(res.data)).catch(() => null);
  }, []);

  const onChange = <K extends keyof HttpRestInputFormData>(key: K, value: HttpRestInputFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.baseUrl.trim()) {
      toast.error(t("common.error"));
      return;
    }
    setSaving(true);
    try {
      await inputService.create(formToPayload(form));
      toast.success(t("input.httpRest.createSuccess"));
      router.push(`/input/${type}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("input.httpRest.newTitle")}</h1>
        <p className="text-muted-foreground">{t("input.httpRest.newSubtitle")}</p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <HttpRestInputForm
          form={form}
          onChange={onChange}
          httpVaultItems={httpVaultItems}
          varSetItems={varSetItems}
          onValidChange={setIsFormValid}
        />
        <div className="flex gap-3">
          <Button type="submit" disabled={saving || !form.name.trim() || !form.baseUrl.trim() || !isFormValid}>
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
