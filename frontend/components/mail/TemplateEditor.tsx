"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { templatesService, type MailTemplate } from "@/services/templates";
import { ApiError } from "@/lib/api";
import { VariableInserter } from "@/components/mail/VariableInserter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// ── helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const VAR_RE = /\{\{([^}]+)\}\}/g;

function highlightVarsHtml(html: string): string {
  return html.replace(
    VAR_RE,
    '<mark style="background:#dbeafe;color:#1d4ed8;border-radius:3px;padding:0 3px;font-size:0.85em;font-weight:600">{{$1}}</mark>',
  );
}

function highlightVarsText(text: string): string {
  return escapeHtml(text).replace(
    VAR_RE,
    '<mark style="background:#dbeafe;color:#1d4ed8;border-radius:3px;padding:0 3px;font-size:0.85em;font-weight:600">{{$1}}</mark>',
  );
}

function buildPreviewDoc(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.65;background:#fff;color:#111827}
  img{max-width:100%}
  a{color:#2563eb}
</style>
</head>
<body>${highlightVarsHtml(body)}</body>
</html>`;
}

// ── component ─────────────────────────────────────────────────────────────────

interface TemplateEditorProps {
  initial?: MailTemplate;
}

export function TemplateEditor({ initial }: TemplateEditorProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    subject: initial?.subject ?? "",
    body: initial?.body ?? "",
    bodyType: (initial?.bodyType as "text" | "html") ?? "html",
  });
  const [saving, setSaving] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertSubjectVar = useCallback((variable: string) => {
    const el = subjectRef.current;
    const cur = form.subject;
    if (!el) { setForm(f => ({ ...f, subject: cur + variable })); return; }
    const start = el.selectionStart ?? cur.length;
    const end = el.selectionEnd ?? cur.length;
    setForm(f => ({ ...f, subject: cur.slice(0, start) + variable + cur.slice(end) }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  }, [form.subject]);

  const insertBodyVar = useCallback((variable: string) => {
    const el = bodyRef.current;
    const cur = form.body;
    if (!el) { setForm(f => ({ ...f, body: cur + variable })); return; }
    const start = el.selectionStart ?? cur.length;
    const end = el.selectionEnd ?? cur.length;
    setForm(f => ({ ...f, body: cur.slice(0, start) + variable + cur.slice(end) }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  }, [form.body]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t("templates.errorNoName")); return; }
    if (!form.subject.trim()) { toast.error(t("templates.errorNoSubject")); return; }
    if (!form.body.trim()) { toast.error(t("templates.errorNoBody")); return; }

    setSaving(true);
    try {
      const payload = { name: form.name, subject: form.subject, body: form.body, bodyType: form.bodyType };
      if (initial) {
        await templatesService.update(initial.id, payload);
      } else {
        await templatesService.create(payload);
      }
      toast.success(initial ? t("templates.updateSuccess") : t("templates.createSuccess"));
      router.push("/output/mail/templates");
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const previewSubjectHtml = highlightVarsText(form.subject || t("templates.subjectPlaceholder"));

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link href="/output/mail/templates">
            <ArrowLeft className="size-4" />
            {t("templates.backToList")}
          </Link>
        </Button>

        <Separator orientation="vertical" className="h-5" />

        <Input
          className="h-8 max-w-xs text-sm"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder={t("templates.name")}
        />

        <div className="ml-auto flex items-center gap-2">
          <Select value={form.bodyType} onValueChange={(v) => setForm(f => ({ ...f, bodyType: v as "text" | "html" }))}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="html">{t("mail.bodyHtml")}</SelectItem>
              <SelectItem value="text">{t("mail.bodyText")}</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            <Save className="size-4" />
            {t("common.save")}
          </Button>
        </div>
      </div>

      {/* ── Split panels ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left — editor */}
        <div className="flex w-1/2 flex-col gap-4 overflow-y-auto border-r p-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("templates.subject")}
              </Label>
              <VariableInserter onInsert={insertSubjectVar} />
            </div>
            <Input
              ref={subjectRef}
              value={form.subject}
              onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder={t("templates.subjectPlaceholder")}
            />
          </div>

          <div className="flex flex-1 flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("templates.body")}
              </Label>
              <VariableInserter onInsert={insertBodyVar} />
            </div>
            <Textarea
              ref={bodyRef}
              value={form.body}
              onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder={
                form.bodyType === "html"
                  ? t("mail.bodyHtmlPlaceholder")
                  : t("mail.bodyTextPlaceholder")
              }
              className="flex-1 resize-none font-mono text-sm"
              style={{ minHeight: "320px" }}
            />
          </div>
        </div>

        {/* Right — preview */}
        <div className="flex w-1/2 flex-col overflow-hidden border-l bg-muted/50">
          {/* Preview header */}
          <div className="shrink-0 border-b bg-background px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("templates.preview")}
            </span>
          </div>

          {/* Subject bar */}
          <div className="shrink-0 border-b bg-background px-4 py-2.5">
            <span className="mr-2 text-xs text-muted-foreground">{t("templates.subject")}:</span>
            <span
              className="text-sm"
              dangerouslySetInnerHTML={{ __html: previewSubjectHtml }}
            />
          </div>

          {/* Body preview */}
          {form.bodyType === "html" ? (
            <iframe
              title="mail-preview"
              className="flex-1 border-0 bg-white"
              srcDoc={buildPreviewDoc(form.body || "<p style='color:#9ca3af'>(empty)</p>")}
              sandbox=""
            />
          ) : (
            <div className="flex-1 overflow-auto bg-white p-6">
              {form.body ? (
                <pre
                  className="whitespace-pre-wrap font-sans text-sm text-gray-800"
                  dangerouslySetInnerHTML={{ __html: highlightVarsText(form.body) }}
                />
              ) : (
                <p className="text-sm italic text-muted-foreground">{t("templates.previewEmpty")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
