"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { inputService, type InputItem } from "@/services/input";
import { vaultService, type HttpVaultItem, type VarSetItem } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  HttpRestInputForm,
  itemToForm,
  formToUpdatePayload,
  type HttpRestInputFormData,
} from "@/components/input/HttpRestInputForm";

interface Props {
  /** Provider type — determines the success redirect URL. */
  type: string;
  /** Input record ID to edit. */
  id: string;
}

export function HttpRestEditPage({ type, id }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  const [item, setItem] = useState<InputItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<HttpRestInputFormData | null>(null);
  const [httpVaultItems, setHttpVaultItems] = useState<HttpVaultItem[]>([]);
  const [varSetItems, setVarSetItems] = useState<VarSetItem[]>([]);
  const [isFormValid, setIsFormValid] = useState(true);

  useEffect(() => {
    Promise.all([
      inputService.getOne(id),
      vaultService.listHttp(undefined, 100),
      vaultService.listVarSet(undefined, 100),
    ])
      .then(([inputData, vaultData, varSetData]) => {
        setItem(inputData);
        setForm(
          itemToForm(
            inputData as unknown as {
              name: string;
              vaultId: string | null;
              config: Record<string, unknown>;
              enabled: boolean;
            },
          ),
        );
        setHttpVaultItems(vaultData.data);
        setVarSetItems(varSetData.data);
      })
      .catch(() => toast.error(t("common.error")));
  }, [id]); // eslint-disable-line

  const onChange = <K extends keyof HttpRestInputFormData>(
    key: K,
    value: HttpRestInputFormData[K],
  ) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await inputService.update(id, formToUpdatePayload(form));
      toast.success(t("input.httpRest.updateSuccess"));
      router.push(`/input/${type}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (!item || !form)
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("input.httpRest.editTitle")}</h1>
        <p className="text-muted-foreground">{t("input.httpRest.editSubtitle")}</p>
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
          <Button type="submit" disabled={saving || !isFormValid}>
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
