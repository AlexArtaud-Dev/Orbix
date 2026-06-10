"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { VarSetForm } from "@/components/vault/VarSetForm";
import { vaultService, type VarSetItem } from "@/services/vault";
import { SkeletonForm } from "@/components/ui/skeleton";

export default function EditVarSetPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<VarSetItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vaultService
      .getVarSet(id)
      .then(setItem)
      .catch(() => {
        toast.error(t("common.error"));
        router.push("/vault/variable-set");
      })
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  if (loading) {
    return <SkeletonForm />;
  }
  if (!item) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("vault.varset.editTitle")}</h1>
        <p className="font-mono text-sm text-muted-foreground">{item.name}</p>
      </div>
      <VarSetForm initial={item} />
    </div>
  );
}
