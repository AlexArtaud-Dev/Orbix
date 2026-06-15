"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
} from "lucide-react";
import {
  sshOutputService,
  type SshOutputConfigItem,
} from "@/services/ssh-output";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonListItems } from "@/components/ui/skeleton";

export function SshOutputListPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<SshOutputConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await sshOutputService.list();
      setItems(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(); // eslint-disable-line
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await sshOutputService.delete(id);
      toast.success(t("output.ssh.deleteSuccess"));
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? t(`errors.${err.code}`, err.message)
          : t("common.error"),
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("output.ssh.title")}
          </h1>
          <p className="text-muted-foreground">{t("output.ssh.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/output/ssh/new">
            <Plus className="size-4" />
            {t("output.ssh.add")}
          </Link>
        </Button>
      </div>

      {loading && items.length === 0 && <SkeletonListItems />}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("output.ssh.noItems")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {items.map((item) => (
          <SshOutputCard
            key={item.id}
            item={item}
            deleting={deletingId === item.id}
            onDelete={() => void handleDelete(item.id)}
            onRefresh={(updated) =>
              setItems((prev) =>
                prev.map((i) => (i.id === updated.id ? updated : i)),
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function SshOutputCard({
  item,
  deleting,
  onDelete,
  onRefresh,
}: {
  item: SshOutputConfigItem;
  deleting: boolean;
  onDelete: () => void;
  onRefresh: (updated: SshOutputConfigItem) => void;
}) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await sshOutputService.test(item.id);
      if (result.ok) {
        toast.success(t("output.ssh.testOk"));
      } else {
        const failedStep = Object.entries(result.steps).find(([, v]) =>
          v.startsWith("error:"),
        );
        toast.error(
          `${t("output.ssh.testFailed")}: ${failedStep ? failedStep[1] : ""}`,
        );
      }
      onRefresh(await sshOutputService.getOne(item.id));
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? t(`errors.${err.code}`, err.message)
          : t("common.error"),
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-2 px-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Server className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {item.lastTestStatus === "ok" && (
              <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
            )}
            {item.lastTestStatus === "error" && (
              <XCircle className="size-3.5 text-destructive shrink-0" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground font-mono">
            {item.destPath}
          </p>
          {item.lastTestStatus === "error" && item.lastTestError && (
            <p className="mt-0.5 text-xs text-destructive truncate">
              {item.lastTestError}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void handleTest()}
            disabled={testing}
            title={t("output.ssh.test")}
          >
            {testing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FlaskConical className="size-3.5" />
            )}
          </Button>

          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/output/ssh/${item.id}`}>
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
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setConfirmDelete(false)}
              >
                <X className="size-3.5" />
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                disabled={deleting}
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete();
                }}
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
