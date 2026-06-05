"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { templatesService, type MailTemplate } from "@/services/templates";
import { ApiError } from "@/lib/api";
import { VariableInserter } from "@/components/mail/VariableInserter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function TemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MailTemplate | null>(null);

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

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (t: MailTemplate) => { setEditing(t); setDialogOpen(true); };

  const handleSaved = (template: MailTemplate) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === template.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = template;
        return next;
      }
      return [template, ...prev];
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await templatesService.delete(id);
      toast.success(t("templates.deleteSuccess"));
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("templates.title")}</h1>
          <p className="text-muted-foreground">{t("templates.subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t("templates.add")}
        </Button>
      </div>

      {loading && templates.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}
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
            onEdit={() => openEdit(tpl)}
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

      <TemplateDialog
        open={dialogOpen}
        template={editing}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
      />
    </div>
  );
}

interface TemplateCardProps {
  template: MailTemplate;
  onEdit: () => void;
  onDelete: () => void;
}

function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{template.name}</span>
            <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground uppercase">
              {template.bodyType}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{template.subject}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t("common.edit")}>
            <Pencil className="size-3.5" />
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

interface TemplateDialogProps {
  open: boolean;
  template: MailTemplate | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (template: MailTemplate) => void;
}

function TemplateDialog({ open, template, onOpenChange, onSaved }: TemplateDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bodyType, setBodyType] = useState<"text" | "html">("text");
  const [saving, setSaving] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setName(template?.name ?? "");
    setSubject(template?.subject ?? "");
    setBody(template?.body ?? "");
    setBodyType((template?.bodyType as "text" | "html") ?? "text");
  }, [template, open]);

  const makeInserter = useCallback(
    (value: string, setValue: (v: string) => void, ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>) =>
      (variable: string) => {
        const el = ref.current;
        if (!el) { setValue(value + variable); return; }
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        setValue(value.slice(0, start) + variable + value.slice(end));
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + variable.length, start + variable.length);
        });
      },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, subject, body, bodyType };
      const saved = template
        ? await templatesService.update(template.id, payload)
        : await templatesService.create(payload);
      toast.success(template ? t("templates.updateSuccess") : t("templates.createSuccess"));
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {template ? t("templates.editTitle") : t("templates.newTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("templates.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("templates.subject")}</Label>
              <VariableInserter onInsert={makeInserter(subject, setSubject, subjectRef)} />
            </div>
            <Input
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("templates.subjectPlaceholder")}
              required
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("templates.body")}</Label>
              <div className="flex items-center gap-2">
                <Select value={bodyType} onValueChange={(v) => setBodyType(v as "text" | "html")}>
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t("mail.bodyText")}</SelectItem>
                    <SelectItem value="html">{t("mail.bodyHtml")}</SelectItem>
                  </SelectContent>
                </Select>
                <VariableInserter onInsert={makeInserter(body, setBody, bodyRef)} />
              </div>
            </div>
            <Textarea
              ref={bodyRef}
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={bodyType === "html" ? t("mail.bodyHtmlPlaceholder") : t("mail.bodyTextPlaceholder")}
              className="font-mono text-sm"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
