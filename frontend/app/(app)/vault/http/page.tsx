"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { vaultService, type HttpVaultItem, type HttpVaultSubtype } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonListItems } from "@/components/ui/skeleton";

const SUBTYPE_BADGE_CLASS: Record<HttpVaultSubtype, string> = {
  token: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  username_password: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  key_secret: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  oauth2_client_credentials: "bg-green-500/15 text-green-600 dark:text-green-400",
  oauth2_password_grant: "bg-green-500/15 text-green-600 dark:text-green-400",
  mtls_certificate: "bg-red-500/15 text-red-600 dark:text-red-400",
  ssh_key: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  jwt_signing_key: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  aws_sigv4: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  cookie: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  custom_kv: "bg-muted text-muted-foreground",
};

export default function VaultHttpListPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<HttpVaultItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async (reset = true, cursor?: string) => {
    setLoading(true);
    try {
      const result = await vaultService.listHttp(reset ? undefined : cursor);
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
      await vaultService.deleteHttp(id);
      toast.success(t("vault.http.deleteSuccess"));
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
          <h1 className="text-2xl font-bold tracking-tight">{t("vault.http.title")}</h1>
          <p className="text-muted-foreground">{t("vault.http.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/vault/http/new">
            <Plus className="size-4" />
            {t("vault.http.add")}
          </Link>
        </Button>
      </div>

      {loading && items.length === 0 && <SkeletonListItems />}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("vault.http.noItems")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <HttpCredentialCard
            key={item.id}
            item={item}
            deleting={deletingId === item.id}
            onDelete={() => void handleDelete(item.id)}
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

interface HttpCredentialCardProps {
  item: HttpVaultItem;
  deleting: boolean;
  onDelete: () => void;
}

function HttpCredentialCard({ item, deleting, onDelete }: HttpCredentialCardProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SUBTYPE_BADGE_CLASS[item.subtype]}`}
            >
              {t(`vault.http.subtypes.${item.subtype}`)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(item.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" asChild aria-label={t("common.edit")}>
            <Link href={`/vault/http/${item.id}`}>
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
