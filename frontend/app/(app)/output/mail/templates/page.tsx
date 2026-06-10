"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { templatesService, type MailTemplate } from "@/services/templates";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonListItems } from "@/components/ui/skeleton";

export default function TemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (reset = true, cursor?: string) => {
    setLoading(true);
    try {
      const res = await templatesService.list(reset ? undefined : cursor);
      setTemplates((prev) => (reset ? res.data : [...prev, ...res.data]));
      setNextCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(true); }, []); // eslint-disable-line

  const handleDelete = async (id: string) => {
    try {
      await templatesService.delete(id);
      toast.success(t("templates.deleteSuccess"));
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("templates.title")}</h1>
          <p className="text-muted-foreground">{t("templates.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/output/mail/templates/new">
            <Plus className="size-4" />
            {t("templates.add")}
          </Link>
        </Button>
      </div>

      {loading && templates.length === 0 && <SkeletonListItems />}
      {!loading && templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("templates.empty")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {templates.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            onDelete={() => void handleDelete(tpl.id)}
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

interface TemplateCardProps {
  template: MailTemplate;
  onDelete: () => void;
}

function TemplateCard({ template, onDelete }: TemplateCardProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{template.name}</span>
            <span className="rounded border px-1.5 py-0.5 text-xs uppercase text-muted-foreground">
              {template.bodyType}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{template.subject}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" asChild aria-label={t("common.edit")}>
            <Link href={`/output/mail/templates/${template.id}`}>
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
