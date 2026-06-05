"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Plus,
  Play,
  Pencil,
  Trash2,
  Check,
  X,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { backupsService, describeCron, type Backup } from "@/services/backups";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function BackupsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await backupsService.list();
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await backupsService.delete(id);
      toast.success(t("backups.deleteSuccess"));
      setItems((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      await backupsService.run(id);
      toast.success(t("backups.runSuccess"));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("backups.title")}</h1>
          <p className="text-muted-foreground">{t("backups.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/backups/new">
            <Plus className="size-4" />
            {t("backups.add")}
          </Link>
        </Button>
      </div>

      {loading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("backups.empty")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {items.map((item) => (
          <BackupCard
            key={item.id}
            item={item}
            deleting={deletingId === item.id}
            running={runningId === item.id}
            onDelete={() => void handleDelete(item.id)}
            onRun={() => void handleRun(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface BackupCardProps {
  item: Backup;
  deleting: boolean;
  running: boolean;
  onDelete: () => void;
  onRun: () => void;
}

function BackupCard({ item, deleting, running, onDelete, onRun }: BackupCardProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const scheduleLabel = item.schedule
    ? describeCron(item.schedule)
    : t("backups.manual");

  const lastRunLabel = item.lastRunAt
    ? new Date(item.lastRunAt).toLocaleString()
    : t("backups.never");

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            <StatusBadge status={item.lastStatus} />
            {!item.enabled && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t("backups.enabledOff")}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {scheduleLabel}
            {" · "}
            {t("backups.lastRun")}: {lastRunLabel}
            {" · "}
            {item.sources.paths.length} source(s)
            {" · "}
            {item.outputs.length} output(s)
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRun}
            disabled={running}
            aria-label={t("backups.runNow")}
          >
            {running ? (
              <Clock className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
          </Button>

          <Button variant="ghost" size="icon-sm" asChild aria-label={t("common.edit")}>
            <Link href={`/backups/${item.id}`}>
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

function StatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation();
  if (status === "success")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-3" />
        {t("backups.statusSuccess")}
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
        <XCircle className="size-3" />
        {t("backups.statusError")}
      </span>
    );
  return null;
}
