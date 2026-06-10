"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Check, X,
  FlaskConical, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { inputService, type InputItem } from "@/services/input";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  /** Provider type — used to build the "new" and "edit" URLs. */
  type: string;
}

export function HttpRestListPage({ type }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<InputItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async (reset = true, cursor?: string) => {
    setLoading(true);
    try {
      const result = await inputService.list(reset ? undefined : cursor);
      const filtered = result.data.filter((i) => i.type === type);
      setItems((prev) => (reset ? filtered : [...prev, ...filtered]));
      setNextCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(true); }, []); // eslint-disable-line

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await inputService.delete(id);
      toast.success(t("input.httpRest.deleteSuccess"));
      setItems((prev) => prev.filter((item) => item.id !== id));
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
          <h1 className="text-2xl font-bold tracking-tight">{t("input.httpRest.title")}</h1>
          <p className="text-muted-foreground">{t("input.httpRest.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href={`/input/${type}/new`}>
            <Plus className="size-4" />
            {t("input.httpRest.add")}
          </Link>
        </Button>
      </div>

      {loading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("input.httpRest.noItems")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {items.map((item) => (
          <InputItemCard
            key={item.id}
            item={item}
            type={type}
            deleting={deletingId === item.id}
            onDelete={() => void handleDelete(item.id)}
            onTestResult={(updated) =>
              setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
            }
          />
        ))}
      </div>

      {nextCursor && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load(false, nextCursor ?? undefined)}
          disabled={loading}
        >
          {t("logs.loadMore")}
        </Button>
      )}
    </div>
  );
}

interface InputItemCardProps {
  item: InputItem;
  type: string;
  deleting: boolean;
  onDelete: () => void;
  onTestResult: (updated: InputItem) => void;
}

function InputItemCard({ item, type, deleting, onDelete, onTestResult }: InputItemCardProps) {
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
            ? t("input.httpRest.testItems", { count: result.count })
            : t("input.httpRest.testOk"),
        );
      } else {
        toast.error(`${t("input.httpRest.testFailed")}: ${result.error ?? ""}`);
      }
      const fresh = await inputService.getOne(item.id);
      onTestResult(fresh);
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setTesting(false);
    }
  };

  const cfg = item.config as { baseUrl?: string };
  const statusIcon =
    item.lastTestStatus === "ok" ? (
      <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
    ) : item.lastTestStatus === "error" ? (
      <XCircle className="size-3.5 text-destructive shrink-0" />
    ) : null;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {!item.enabled && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {t("backups.enabledOff")}
              </span>
            )}
            {statusIcon}
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
            {cfg.baseUrl ?? "—"}
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
            aria-label={t("input.httpRest.test")}
            title={t("input.httpRest.test")}
          >
            {testing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FlaskConical className="size-3.5" />
            )}
          </Button>

          <Button variant="ghost" size="icon-sm" asChild aria-label={t("common.edit")}>
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
              aria-label={t("common.delete")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setConfirmDelete(false)}
                aria-label={t("common.cancel")}
              >
                <X className="size-3.5" />
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                disabled={deleting}
                onClick={() => { setConfirmDelete(false); onDelete(); }}
                aria-label={t("common.confirm")}
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
