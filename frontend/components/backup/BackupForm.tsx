"use client";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ContactPicker } from "@/components/mail/ContactPicker";
import { VariableInserter } from "@/components/mail/VariableInserter";
import { SourcePicker } from "./SourcePicker";
import { vaultService, type EmailVaultItem } from "@/services/vault";
import { templatesService, type MailTemplate } from "@/services/templates";
import { contactsService, type Contact } from "@/services/contacts";
import { describeCron, type CreateBackupPayload, type Backup } from "@/services/backups";

interface OutputForm {
  type: string;
  vaultId: string;
  templateId: string;
  recipientsTo: Contact[];
  recipientsCc: Contact[];
  recipientsBcc: Contact[];
  overrideSubject: string;
  overrideBody: string;
  overrideBodyType: string;
}

function emptyOutput(): OutputForm {
  return {
    type: "mail",
    vaultId: "",
    templateId: "",
    recipientsTo: [],
    recipientsCc: [],
    recipientsBcc: [],
    overrideSubject: "",
    overrideBody: "",
    overrideBodyType: "text",
  };
}

interface FormState {
  name: string;
  sources: string[];
  exclude: string;
  compression: string;
  schedule: string;
  enabled: boolean;
  outputs: OutputForm[];
}

function backupToForm(backup?: Backup): FormState {
  if (!backup) {
    return {
      name: "",
      sources: [],
      exclude: "",
      compression: "auto",
      schedule: "",
      enabled: true,
      outputs: [],
    };
  }
  return {
    name: backup.name,
    sources: backup.sources.paths,
    exclude: (backup.sources.exclude ?? []).join(", "),
    compression: backup.compression,
    schedule: backup.schedule ?? "",
    enabled: backup.enabled,
    outputs: backup.outputs.map((o) => ({
      type: o.type,
      vaultId: o.vaultId,
      templateId: o.templateId ?? "",
      recipientsTo: [],
      recipientsCc: [],
      recipientsBcc: [],
      overrideSubject: o.overrideSubject ?? "",
      overrideBody: o.overrideBody ?? "",
      overrideBodyType: o.overrideBodyType ?? "text",
    })),
  };
}

interface BackupFormProps {
  initial?: Backup;
  saving: boolean;
  onSubmit: (payload: CreateBackupPayload) => void;
  onCancel: () => void;
}

export function BackupForm({ initial, saving, onSubmit, onCancel }: BackupFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(() => backupToForm(initial));
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const [vaultItems, setVaultItems] = useState<EmailVaultItem[]>([]);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const loadAll = async () => {
      const [vaultRes, tplRes, contactsRes] = await Promise.allSettled([
        vaultService.listEmail(undefined, 100),
        templatesService.list(undefined, 100),
        contactsService.list(undefined, 100),
      ]);
      if (vaultRes.status === "fulfilled") setVaultItems(vaultRes.value.data);
      if (tplRes.status === "fulfilled") setTemplates(tplRes.value.data);
      if (contactsRes.status === "fulfilled") {
        const allContacts = contactsRes.value.data;
        setContacts(allContacts);
        if (initial) {
          setForm((prev) => ({
            ...prev,
            outputs: prev.outputs.map((o, i) => {
              const src = initial.outputs[i];
              if (!src) return o;
              return {
                ...o,
                recipientsTo: allContacts.filter((c) => src.recipientsTo.includes(c.id)),
                recipientsCc: allContacts.filter((c) => src.recipientsCc.includes(c.id)),
                recipientsBcc: allContacts.filter((c) => src.recipientsBcc.includes(c.id)),
              };
            }),
          }));
        }
      }
    };
    void loadAll();
  }, []); // eslint-disable-line

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const removeSource = (path: string) =>
    set("sources", form.sources.filter((p) => p !== path));

  const addOutput = () => set("outputs", [...form.outputs, emptyOutput()]);

  const removeOutput = (idx: number) =>
    set("outputs", form.outputs.filter((_, i) => i !== idx));

  const setOutput = <K extends keyof OutputForm>(idx: number, key: K, value: OutputForm[K]) =>
    set(
      "outputs",
      form.outputs.map((o, i) => (i === idx ? { ...o, [key]: value } : o)),
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateBackupPayload = {
      name: form.name,
      sources: {
        paths: form.sources,
        exclude: form.exclude
          ? form.exclude.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      },
      compression: form.compression,
      schedule: form.schedule.trim() || null,
      enabled: form.enabled,
      outputs: form.outputs.map((o) => ({
        type: o.type,
        vaultId: o.vaultId,
        templateId: o.templateId || undefined,
        recipientsTo: o.recipientsTo.map((c) => c.id),
        recipientsCc: o.recipientsCc.map((c) => c.id),
        recipientsBcc: o.recipientsBcc.map((c) => c.id),
        overrideSubject: o.overrideSubject || undefined,
        overrideBody: o.overrideBody || undefined,
        overrideBodyType: o.overrideBody ? o.overrideBodyType : undefined,
      })),
    };
    onSubmit(payload);
  };

  const cronPreview = form.schedule.trim()
    ? describeCron(form.schedule.trim())
    : null;

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("backups.general")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="name">{t("backups.name")}</FieldLabel>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={t("backups.namePlaceholder")}
                  required
                />
              </Field>
              <Field orientation="horizontal" className="items-center rounded-lg border px-3 py-2.5">
                <div className="flex-1 space-y-0.5">
                  <FieldLabel htmlFor="enabled" className="text-sm font-medium cursor-pointer">
                    {t("backups.enabled")}
                  </FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    {form.enabled ? t("backups.enabledOn") : t("backups.enabledOff")}
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={form.enabled}
                  onCheckedChange={(checked) => set("enabled", checked)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="compression">{t("backups.compression")}</FieldLabel>
                <Select value={form.compression} onValueChange={(v) => set("compression", v)}>
                  <SelectTrigger id="compression">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("backups.compressionNone")}</SelectItem>
                    <SelectItem value="auto">{t("backups.compressionAuto")}</SelectItem>
                    <SelectItem value="forced">{t("backups.compressionForced")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="schedule">{t("backups.schedule")}</FieldLabel>
                <div className="space-y-1">
                  <Input
                    id="schedule"
                    value={form.schedule}
                    onChange={(e) => set("schedule", e.target.value)}
                    placeholder={t("backups.schedulePlaceholder")}
                    className="font-mono"
                  />
                  {cronPreview && cronPreview !== form.schedule.trim() && (
                    <p className="text-xs text-muted-foreground">
                      {t("backups.schedulePreview")}{cronPreview}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{t("backups.scheduleHint")}</p>
                </div>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Sources */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{t("backups.sources")}</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSourcesOpen(true)}
            >
              <FolderOpen className="size-3.5" />
              {t("backups.addSource")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("backups.sourcesDesc")}</p>

          {form.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No sources selected</p>
          ) : (
            <ul className="space-y-1.5">
              {form.sources.map((path) => (
                <li
                  key={path}
                  className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm"
                >
                  <span className="flex-1 truncate font-mono text-xs">{path}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSource(path)}
                    aria-label="Remove"
                  >
                    <X className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Field>
            <FieldLabel>{t("backups.exclude")}</FieldLabel>
            <Input
              value={form.exclude}
              onChange={(e) => set("exclude", e.target.value)}
              placeholder={t("backups.excludePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("backups.excludeHint")}</p>
          </Field>
        </CardContent>
      </Card>

      {/* Outputs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{t("backups.outputs")}</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOutput}
            >
              <Plus className="size-3.5" />
              {t("backups.addOutput")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-xs text-muted-foreground">{t("backups.outputsDesc")}</p>

          {form.outputs.map((output, idx) => (
            <div key={idx} className="space-y-3">
              {idx > 0 && <Separator />}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Output {idx + 1} — {output.type}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => removeOutput(idx)}
                  aria-label={t("backups.removeOutput")}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <FieldGroup>
                <Field>
                  <FieldLabel>{t("backups.outputVault")}</FieldLabel>
                  <Select
                    value={output.vaultId}
                    onValueChange={(v) => setOutput(idx, "vaultId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select SMTP account…" />
                    </SelectTrigger>
                    <SelectContent>
                      {vaultItems.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{t("backups.outputTemplate")}</FieldLabel>
                  <Select
                    value={output.templateId || "__none__"}
                    onValueChange={(v) => setOutput(idx, "templateId", v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("backups.outputTemplatePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("backups.outputTemplatePlaceholder")}</SelectItem>
                      {templates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{t("backups.outputTo")}</FieldLabel>
                  <ContactPicker
                    contacts={contacts}
                    selected={output.recipientsTo}
                    onChange={(sel) => setOutput(idx, "recipientsTo", sel)}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t("backups.outputCc")}</FieldLabel>
                    <ContactPicker
                      contacts={contacts}
                      selected={output.recipientsCc}
                      onChange={(sel) => setOutput(idx, "recipientsCc", sel)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("backups.outputBcc")}</FieldLabel>
                    <ContactPicker
                      contacts={contacts}
                      selected={output.recipientsBcc}
                      onChange={(sel) => setOutput(idx, "recipientsBcc", sel)}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>{t("backups.outputOverrideSubject")}</FieldLabel>
                  <div className="flex gap-1">
                    <Input
                      value={output.overrideSubject}
                      onChange={(e) => setOutput(idx, "overrideSubject", e.target.value)}
                      placeholder={t("backups.outputOverrideSubjectPlaceholder")}
                      className="flex-1"
                    />
                    <VariableInserter
                      onInsert={(v) => setOutput(idx, "overrideSubject", output.overrideSubject + v)}
                    />
                  </div>
                </Field>

                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel>{t("backups.outputOverrideBody")}</FieldLabel>
                    <div className="flex items-center gap-2">
                      <Select
                        value={output.overrideBodyType}
                        onValueChange={(v) => setOutput(idx, "overrideBodyType", v)}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">{t("mail.bodyText")}</SelectItem>
                          <SelectItem value="html">{t("mail.bodyHtml")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <VariableInserter
                        onInsert={(v) => setOutput(idx, "overrideBody", output.overrideBody + v)}
                      />
                    </div>
                  </div>
                  <Textarea
                    value={output.overrideBody}
                    onChange={(e) => setOutput(idx, "overrideBody", e.target.value)}
                    placeholder={t("backups.outputOverrideBodyPlaceholder")}
                    rows={4}
                  />
                </Field>
              </FieldGroup>
            </div>
          ))}

          {form.outputs.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              No outputs configured — the backup will run silently.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t("common.loading") : t("common.save")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>

      <SourcePicker
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        selected={form.sources}
        onSelect={(paths) =>
          set("sources", [...new Set([...form.sources, ...paths])])
        }
      />
    </form>
  );
}
