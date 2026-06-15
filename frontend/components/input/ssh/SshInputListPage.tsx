"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Check, X,
  FlaskConical, CheckCircle2, XCircle, Loader2, Server,
} from "lucide-react";
import { inputService, type InputItem } from "@/services/input";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonListItems } from "@/components/ui/skeleton";
import type { SshInputConfig } from "./ssh-input.client-types";

interface Props { type: string }

export function SshInputListPage({ type }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<InputItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await inputService.list(undefined, 100);
      setItems(result.data.filter((i) => i.type === type));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await inputService.delete(id);
      toast.success(t("input.ssh.deleteSuccess"));
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("input.ssh.title")}</h1>
          <p className="text-muted-foreground">{t("input.ssh.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href={`/input/${type}/new`}>
            <Plus className="size-4" />
            {t("input.ssh.add")}
          </Link>
        </Button>
      </div>

      {loading && items.length === 0 && <SkeletonListItems />}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("input.ssh.noItems")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {items.map((item) => (
          <SshInputCard
            key={item.id}
            item={item}
            type={type}
            deleting={deletingId === item.id}
            onDelete={() => void handleDelete(item.id)}
            onRefresh={(updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))}
          />
        ))}
      </div>
    </div>
  );
}

function SshInputCard({
  item, type, deleting, onDelete, onRefresh,
}: {
  item: InputItem;
  type: string;
  deleting: boolean;
  onDelete: () => void;
  onRefresh: (updated: InputItem) => void;
}) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await inputService.test(item.id);
      if (result.success) {
        toast.success(
          result.count !== undefined
            ? t("input.ssh.testSources", { count: result.count })
            : t("input.ssh.testOk"),
        );
      } else {
        toast.error(`${t("input.ssh.testFailed")}: ${result.error ?? ""}`);
      }
      onRefresh(await inputService.getOne(item.id));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setTesting(false);
    }
  };

  const cfg = item.config as unknown as SshInputConfig;
  const sourceCount = cfg.sources?.length ?? 0;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-2 px-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Server className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {!item.enabled && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {t("backups.enabledOff")}
              </span>
            )}
            {item.lastTestStatus === "ok" && <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />}
            {item.lastTestStatus === "error" && <XCircle className="size-3.5 text-destructive shrink-0" />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("input.ssh.sourcesCount", { count: sourceCount })}
          </p>
          {item.lastTestStatus === "error" && item.lastTestError && (
            <p className="mt-0.5 text-xs text-destructive truncate">{item.lastTestError}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void handleTest()}
            disabled={testing}
            title={t("input.ssh.test")}
          >
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
          </Button>

          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/input/${type}/${item.id}`}>
              <Pencil className="size-3.5" />
            </Link>
          </Button>

          {!confirmDelete ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(false)}>
                <X className="size-3.5" />
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                disabled={deleting}
                onClick={() => { setConfirmDelete(false); onDelete(); }}
              >
                <Check className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
