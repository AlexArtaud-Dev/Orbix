"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Wifi, WifiOff, Clock, Trash2, Check, X } from "lucide-react";
import { vaultService, type EmailVaultItem } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonListItems } from "@/components/ui/skeleton";

export default function VaultEmailListPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<EmailVaultItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = async (reset = true, cursor?: string) => {
    setLoading(true);
    try {
      const result = await vaultService.listEmail(reset ? undefined : cursor);
      setItems((prev) => (reset ? result.data : [...prev, ...result.data]));
      setNextCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(true); }, []); // eslint-disable-line

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await vaultService.deleteEmail(id);
      toast.success(t("vault.deleteSuccess"));
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await vaultService.testEmail(id);
      toast.success(t("vault.testSuccess"));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    }
    // Always refresh status and stop spinner, even if test or refresh fails
    try {
      const updated = await vaultService.getEmail(id);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch { /* ignore */ }
    setTestingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("vault.emailTitle")}</h1>
          <p className="text-muted-foreground">{t("vault.emailSubtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/vault/email/new">
            <Plus className="size-4" />
            {t("vault.addEmail")}
          </Link>
        </Button>
      </div>

      {loading && items.length === 0 && <SkeletonListItems />}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("vault.noEmailConfigs")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <EmailConfigCard
            key={item.id}
            item={item}
            deleting={deletingId === item.id}
            testing={testingId === item.id}
            onDelete={() => void handleDelete(item.id)}
            onTest={() => void handleTest(item.id)}
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

interface SmtpStatusBadgeProps {
  status: string | null | undefined;
}

function SmtpStatusBadge({ status }: SmtpStatusBadgeProps) {
  const { t } = useTranslation();
  if (status === "ok")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        <Wifi className="size-3" /> OK
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
        <WifiOff className="size-3" /> Error
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <Clock className="size-3" /> {t("vault.statusNever")}
    </span>
  );
}

interface EmailConfigCardProps {
  item: EmailVaultItem;
  deleting: boolean;
  testing: boolean;
  onDelete: () => void;
  onTest: () => void;
}

function EmailConfigCard({ item, deleting, testing, onDelete, onTest }: EmailConfigCardProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            <SmtpStatusBadge status={item.healthCheck?.status} />
          </div>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {item.host}:{item.port} · {item.user}
            {" · "}
            {item.fromName ? `${item.fromName} <${item.fromAddr}>` : item.fromAddr}
            {item.secure ? " · SSL/TLS" : " · STARTTLS"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" asChild aria-label={t("common.edit")}>
            <Link href={`/vault/email/${item.id}`}>
              <Pencil className="size-3.5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onTest} disabled={testing} aria-label={t("vault.testSmtp")}>
            {testing ? <Clock className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />}
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
              <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(false)} aria-label={t("common.cancel")}>
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
