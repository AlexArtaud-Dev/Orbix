"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Server, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { vaultService, type SshVaultItem } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonListItems } from "@/components/ui/skeleton";

const SUBTYPE_BADGE: Record<string, string> = {
  user_password: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  ssh_key: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

export default function VaultSshListPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<SshVaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const items = await vaultService.listSsh();
      setItems(items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await vaultService.deleteSsh(id);
      toast.success(t("vault.ssh.deleteSuccess"));
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await vaultService.testSsh(id);
      if (res.ok) {
        toast.success(t("vault.ssh.testOk"));
      } else {
        const { steps } = res;
        let detail = "";
        if (steps.connection !== "ok") detail = `${t("vault.ssh.steps.connection")}: ${steps.connection}`;
        else if (steps.path !== "ok") detail = `${t("vault.ssh.steps.path")}: ${steps.path}`;
        else if (steps.write !== "ok") detail = `${t("vault.ssh.steps.write")}: ${steps.write}`;
        toast.error(t("vault.ssh.testFailed"), { description: detail });
      }
      setItems((prev) => prev.map((i) =>
        i.id === id
          ? { ...i, healthCheck: { status: res.ok ? "ok" : "error", statusMsg: JSON.stringify(res.steps), checkedAt: new Date().toISOString() } }
          : i,
      ));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("vault.ssh.testFailed"));
      setItems((prev) => prev.map((i) =>
        i.id === id
          ? { ...i, healthCheck: { status: "error", statusMsg: null, checkedAt: new Date().toISOString() } }
          : i,
      ));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("vault.ssh.title")}</h1>
          <p className="text-muted-foreground">{t("vault.ssh.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/vault/ssh-remote/new">
            <Plus className="size-4" />
            {t("vault.ssh.add")}
          </Link>
        </Button>
      </div>

      {loading && items.length === 0 && <SkeletonListItems />}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("vault.ssh.noItems")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <SshCredentialCard
            key={item.id}
            item={item}
            deleting={deletingId === item.id}
            testing={testingId === item.id}
            onDelete={() => void handleDelete(item.id)}
            onTest={() => void handleTest(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface SshCredentialCardProps {
  item: SshVaultItem;
  deleting: boolean;
  testing: boolean;
  onDelete: () => void;
  onTest: () => void;
}

function SshCredentialCard({ item, deleting, testing, onDelete, onTest }: SshCredentialCardProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hc = item.healthCheck;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 px-3 py-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Server className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SUBTYPE_BADGE[item.subtype]}`}>
              {t(`vault.ssh.subtypes.${item.subtype}`)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.username}@{item.host}:{item.port} — {item.defaultPath}
          </p>
        </div>

        {hc && (
          <div className="shrink-0">
            {hc.status === "ok"
              ? <CheckCircle2 className="size-4 text-green-500" />
              : <XCircle className="size-4 text-destructive" />}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : t("vault.ssh.test")}
          </Button>

          <Button variant="ghost" size="icon-sm" asChild aria-label={t("common.edit")}>
            <Link href={`/vault/ssh-remote/${item.id}`}>
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
