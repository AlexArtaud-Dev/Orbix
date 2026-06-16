"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Plus, Play, Pencil, Trash2, Check, X,
  CheckCircle2, XCircle, Clock, Loader2, Power, PowerOff,
  AlertTriangle, TriangleAlert, CalendarClock,
} from "lucide-react";
import { backupsService, describeSchedule, computeNextRun, formatNextRun, type Backup } from "@/services/backups";
import { inputService, type InputItem } from "@/services/input";
import { BackupPipelineDialog } from "@/components/backup/BackupPipeline";
import { logsService, type LogEntry } from "@/services/logs";
import { ApiError } from "@/lib/api";
import { SkeletonListItems } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function BackupsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMap, setInputMap] = useState<Map<string, InputItem>>(new Map());

  const load = async () => {
    setLoading(true);
    try {
      const [backups, inputs] = await Promise.all([
        backupsService.list(),
        inputService.list(undefined, 100),
      ]);
      setItems(backups);
      setInputMap(new Map(inputs.data.map((i) => [i.id, i])));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line

  const updateItem = (updated: Backup) =>
    setItems((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((b) => b.id !== id));

  return (
    <TooltipProvider>
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

        {loading && items.length === 0 && <SkeletonListItems />}

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
              inputMap={inputMap}
              onUpdated={updateItem}
              onRemoved={() => removeItem(item.id)}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

interface BackupCardProps {
  item: Backup;
  inputMap: Map<string, InputItem>;
  onUpdated: (b: Backup) => void;
  onRemoved: () => void;
}

function BackupCard({ item, inputMap, onUpdated, onRemoved }: BackupCardProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<"run" | "toggle" | "delete" | null>(null);
  const [errorLogs, setErrorLogs] = useState<LogEntry[] | null>(null);
  const [errorCount, setErrorCount] = useState<number | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  // Load error count for this backup
  useEffect(() => {
    logsService.getBackupLogs(item.id, 200).then((all) => {
      setErrorCount(all.filter((l) => l.level === "ERROR").length);
    }).catch(() => null);
  }, [item.id]);  

  const handleOpenLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await logsService.getBackupLogs(item.id, 100);
      setErrorLogs(logs);
    } catch {
      // ignore
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    setClearingLogs(true);
    try {
      await logsService.clearBackupLogs(item.id);
      setErrorLogs([]);
      setErrorCount(0);
      toast.success(t("backups.logsClearedSuccess"));
      // Notify sidebar to refresh its error badge
      window.dispatchEvent(new CustomEvent("orbix:logs-changed"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setClearingLogs(false);
    }
  };

  const scheduleLabel = describeSchedule(item);
  const nextRun = computeNextRun(item);
  const nextRunLabel = nextRun ? formatNextRun(nextRun) : null;
  const lastRunLabel = item.lastRunAt
    ? new Date(item.lastRunAt).toLocaleString()
    : t("backups.never");

  // Input cascade: any input source not yet tested → block run + show badge
  const inputNeedsRetest = item.sources.sources.some(
    (s) => s.type === "input" && s.inputId && inputMap.get(s.inputId)?.lastTestStatus !== "ok",
  );

  const canRun = item.isValidated && !inputNeedsRetest;
  const canEnable = item.isValidated && !item.enabled && !inputNeedsRetest;

  const handleRun = async () => {
    if (!canRun) return;
    setBusy("run");
    try {
      await backupsService.run(item.id);
      toast.success(t("backups.runSuccess"));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const handleToggleEnabled = async () => {
    if (!item.isValidated && !item.enabled) return;
    setBusy("toggle");
    try {
      const updated = await backupsService.update(item.id, { enabled: !item.enabled });
      onUpdated(updated);
      toast.success(item.enabled ? t("backups.disabledSuccess") : t("backups.enabledSuccess"));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy("delete");
    try {
      await backupsService.delete(item.id);
      toast.success(t("backups.deleteSuccess"));
      onRemoved();
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  };

  return (
    <>
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{item.name}</span>
            <StatusBadge status={item.lastStatus} validationStatus={item.validationStatus} />
            {!item.enabled && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t("backups.enabledOff")}
              </span>
            )}
            {!item.isValidated && (
              <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                {t("backups.notValidated")}
              </span>
            )}
            {inputNeedsRetest && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 cursor-default">
                    <AlertTriangle className="size-3" />
                    {t("backups.sources.inputNeedsRetest")}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  {t("backups.tooltips.inputNeedsRetest")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarClock className="size-3 shrink-0 opacity-60" />
                {scheduleLabel}
              </span>
              {nextRunLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary/80">
                  <Clock className="size-2.5 shrink-0" />
                  {t("backups.nextRun")}: {nextRunLabel}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              {t("backups.lastRun")}: {lastRunLabel}
              {" · "}
              {item.sources.sources.length} src · {item.outputs.length} out
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Pipeline visualizer */}
          <BackupPipelineDialog backup={item} inputMap={inputMap} />

          {/* Error logs button */}
          {(errorCount ?? 0) > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleOpenLogs()}
                  disabled={loadingLogs}
                  aria-label={t("backups.viewErrors")}
                  className="relative"
                >
                  {loadingLogs ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <TriangleAlert className="size-3.5 text-destructive" />
                      <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white ring-1 ring-red-700 py-0.5">
                        {(errorCount ?? 0) > 9 ? "9+" : errorCount}
                      </span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("backups.viewErrors")} ({errorCount})</TooltipContent>
            </Tooltip>
          )}

          {/* Run now */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleRun()}
                  disabled={busy !== null || !canRun}
                  aria-label={t("backups.runNow")}
                >
                  {busy === "run" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {canRun
                ? t("backups.runNow")
                : inputNeedsRetest
                ? t("backups.tooltips.inputNeedsRetest")
                : t("backups.tooltips.runDisabled")}
            </TooltipContent>
          </Tooltip>

          {/* Toggle enabled */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleToggleEnabled()}
                  disabled={busy !== null || (!item.isValidated && !item.enabled)}
                  aria-label={item.enabled ? t("backups.disable") : t("backups.enable")}
                >
                  {busy === "toggle" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : item.enabled ? (
                    <Power className="size-3.5 text-green-500" />
                  ) : (
                    <PowerOff className="size-3.5 text-muted-foreground" />
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {item.enabled
                ? t("backups.disable")
                : canEnable
                ? t("backups.enable")
                : inputNeedsRetest
                ? t("backups.tooltips.inputNeedsRetest")
                : t("backups.tooltips.enableDisabled")}
            </TooltipContent>
          </Tooltip>

          {/* Edit */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" asChild aria-label={t("common.edit")}>
                <Link href={`/backups/${item.id}`}>
                  <Pencil className="size-3.5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.edit")}</TooltipContent>
          </Tooltip>

          {/* Delete */}
          {!confirmDelete ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy !== null}
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.delete")}</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setConfirmDelete(false)}
                    aria-label={t("common.cancel")}
                  >
                    <X className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("common.cancel")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    disabled={busy === "delete"}
                    onClick={() => void handleDelete()}
                    aria-label={t("common.confirm")}
                  >
                    {busy === "delete" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("backups.tooltips.confirmDelete")}</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </CardContent>
    </Card>
      {/* Error logs dialog */}
      <Dialog open={errorLogs !== null} onOpenChange={(open) => { if (!open) setErrorLogs(null); }}>
        <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              {t("backups.logsDialogTitle")} — {item.name}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
            {errorLogs?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("backups.logsEmpty")}</p>
            )}
            {errorLogs?.map((log, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md border px-3 py-2 text-xs font-mono",
                  log.level === "ERROR"
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-border bg-muted/30",
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold">{log.level}</span>
                  <span className="text-muted-foreground">{new Date(log.ts).toLocaleString()}</span>
                  <span className="text-muted-foreground">{log.code}</span>
                </div>
                <p>{log.msg}</p>
                {log.detail && <p className="mt-0.5 text-muted-foreground">{log.detail}</p>}
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleClearLogs()}
              disabled={clearingLogs || !errorLogs?.length}
            >
              {clearingLogs ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {t("backups.clearLogs")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setErrorLogs(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({
  status,
  validationStatus,
}: {
  status: string | null;
  validationStatus: string | null;
}) {
  const { t } = useTranslation();

  if (validationStatus === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
        <Clock className="size-3 animate-spin" />
        {t("backups.validating")}
      </span>
    );
  }

  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-3" />
        {t("backups.statusSuccess")}
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
        <XCircle className="size-3" />
        {t("backups.statusError")}
      </span>
    );
  }

  return null;
}
