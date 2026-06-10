"use client";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, Loader2, PlayCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { backupsService, type Backup } from "@/services/backups";
import { ApiError } from "@/lib/api";

interface StepValidateProps {
  backupId: string | null;
  backup: Backup | null;
  sourcesCount: number;
  onBackupUpdated: (backup: Backup) => void;
}

export function StepValidate({ backupId, backup, sourcesCount, onBackupUpdated }: StepValidateProps) {
  const { t } = useTranslation();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const status = backup?.validationStatus ?? null;
  const isRunning = status === "running";

  // Poll while running
  useEffect(() => {
    if (!backupId || !isRunning) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const updated = await backupsService.getOne(backupId);
        onBackupUpdated(updated);
        if (updated.validationStatus !== "running") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 3000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [backupId, isRunning]); // eslint-disable-line

  const handleRunValidation = async () => {
    if (!backupId) return;
    try {
      await backupsService.validate(backupId);
      const updated = await backupsService.getOne(backupId);
      onBackupUpdated(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">{t("backups.wizard.stepValidate")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("backups.wizard.stepValidateDesc")}</p>
      </div>

      {!backupId && (
        <div className="rounded-lg border border-dashed p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0" />
          {t("backups.wizard.validateSaveFirst")}
        </div>
      )}

      {backupId && sourcesCount === 0 && (
        <div className="rounded-lg border border-yellow-400/40 bg-yellow-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="size-4 shrink-0 text-yellow-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-600 dark:text-yellow-400">{t("backups.wizard.noSourcesWarning")}</p>
            <p className="text-muted-foreground mt-0.5">{t("backups.wizard.noSourcesWarningDesc")}</p>
          </div>
        </div>
      )}

      {backupId && (
        <div className="space-y-4">
          {/* Status card */}
          <div className="rounded-lg border p-5">
            {!status && (
              <div className="flex items-center gap-3">
                <PlayCircle className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{t("backups.wizard.validateNotRun")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("backups.wizard.validateNotRunDesc")}
                  </p>
                </div>
              </div>
            )}

            {status === "running" && (
              <div className="flex items-center gap-3">
                <Loader2 className="size-8 text-primary animate-spin" />
                <div>
                  <p className="font-medium text-sm">{t("backups.wizard.validateRunning")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("backups.wizard.validateRunningDesc")}
                  </p>
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-8 text-green-500" />
                <div>
                  <p className="font-medium text-sm text-green-600 dark:text-green-400">
                    {t("backups.wizard.validateSuccess")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {backup?.validatedAt
                      ? new Date(backup.validatedAt).toLocaleString()
                      : ""}
                  </p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <XCircle className="size-8 text-red-500 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-red-600 dark:text-red-400">
                      {t("backups.wizard.validateError")}
                    </p>
                  </div>
                </div>
                {backup?.validationError && (
                  <pre className="text-xs rounded bg-destructive/5 border border-destructive/20 p-3 overflow-auto max-h-32 text-destructive">
                    {backup.validationError}
                  </pre>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => void handleRunValidation()}
              disabled={isRunning}
              variant={status === "success" ? "outline" : "default"}
            >
              {isRunning ? (
                <><Loader2 className="size-3.5 animate-spin" />{t("backups.wizard.validateRunning")}</>
              ) : status === "success" ? (
                t("backups.wizard.validateRerun")
              ) : (
                t("backups.wizard.validateRun")
              )}
            </Button>
          </div>

          {status === "success" && (
            <p className="text-xs text-green-600 dark:text-green-400">
              {t("backups.wizard.validateSuccessHint")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
