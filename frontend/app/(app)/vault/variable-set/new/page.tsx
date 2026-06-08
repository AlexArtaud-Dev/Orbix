"use client";
import { useTranslation } from "react-i18next";
import { VarSetForm } from "@/components/vault/VarSetForm";

export default function NewVarSetPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("vault.varset.newTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("vault.varset.newSubtitle")}</p>
      </div>
      <VarSetForm />
    </div>
  );
}
