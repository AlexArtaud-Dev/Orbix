"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import {
  vaultService,
  type VarSetItem,
  type VarSetVariable,
} from "@/services/vault";

interface VarSetFormProps {
  /** Existing item — if provided, the form is in edit mode */
  initial?: VarSetItem & { _variables?: VarSetVariable[] };
}

/** Note: VarSetItem from the list API only has variableCount, not actual values.
 *  The edit page must pass variables separately if it fetches them (not possible with current API
 *  because values are encrypted and not returned). Instead we start with an empty list
 *  in edit mode — the user re-enters the values they want to keep. */
export function VarSetForm({ initial }: VarSetFormProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? "");
  const [variables, setVariables] = useState<VarSetVariable[]>(
    initial?._variables ?? [],
  );
  const [isSaving, setIsSaving] = useState(false);

  const addVariable = () =>
    setVariables((v) => [...v, { key: "", value: "" }]);

  const updateVariable = (
    idx: number,
    field: keyof VarSetVariable,
    val: string,
  ) =>
    setVariables((v) =>
      v.map((item, i) => (i === idx ? { ...item, [field]: val } : item)),
    );

  const removeVariable = (idx: number) =>
    setVariables((v) => v.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("vault.varset.errorNoName"));
      return;
    }
    const hasEmptyKey = variables.some((v) => !v.key.trim());
    if (hasEmptyKey) {
      toast.error(t("vault.varset.errorEmptyKey"));
      return;
    }
    setIsSaving(true);
    try {
      if (initial) {
        await vaultService.updateVarSet(initial.id, { name, variables });
        toast.success(t("vault.varset.updateSuccess"));
      } else {
        await vaultService.createVarSet({ name, variables });
        toast.success(t("vault.varset.createSuccess"));
      }
      router.push("/vault/variable-set");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("common.actions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="varsetName">{t("vault.varset.name")}</FieldLabel>
              <Input
                id="varsetName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("vault.varset.namePlaceholder")}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">{t("vault.varset.variables")}</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addVariable}>
            <Plus className="size-3.5" />
            {t("vault.varset.addVariable")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {variables.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {t("vault.varset.noVariables")}
            </p>
          ) : (
            variables.map((variable, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={variable.key}
                  onChange={(e) => updateVariable(idx, "key", e.target.value)}
                  placeholder={t("vault.varset.keyPlaceholder")}
                  className="font-mono flex-1"
                />
                <Input
                  value={variable.value}
                  onChange={(e) => updateVariable(idx, "value", e.target.value)}
                  placeholder={t("vault.varset.valuePlaceholder")}
                  type="password"
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeVariable(idx)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {initial && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t("vault.varset.editWarning")}
        </p>
      )}

      <Separator />

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={() => router.push("/vault/variable-set")}>
          {t("common.cancel")}
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={isSaving}>
          {isSaving && <Loader2 className="size-3.5 animate-spin" />}
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
