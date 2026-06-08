"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2, KeySquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { vaultService, type VarSetItem } from "@/services/vault";

export default function VarSetListPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<VarSetItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await vaultService.listVarSet(undefined, 100);
      setItems(res.data);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line

  const handleDelete = async (id: string, name: string) => {
    try {
      await vaultService.deleteVarSet(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(t("vault.varset.deleteSuccess"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("vault.varset.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("vault.varset.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/vault/variable-set/new">
            <Plus className="size-3.5" />
            {t("vault.varset.add")}
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("vault.varset.noItems")}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <KeySquare className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("vault.varset.variableCount", { count: item.variableCount })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/vault/variable-set/${item.id}`}>{t("common.edit")}</Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => void handleDelete(item.id, item.name)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
