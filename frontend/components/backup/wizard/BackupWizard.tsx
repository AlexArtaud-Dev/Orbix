"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { backupsService, type Backup } from "@/services/backups";
import { vaultService, type EmailVaultItem, type HttpVaultItem } from "@/services/vault";
import { templatesService, type MailTemplate } from "@/services/templates";
import { contactsService, type Contact } from "@/services/contacts";
import { ApiError } from "@/lib/api";

import { StepBasic } from "./StepBasic";
import { StepSchedule } from "./StepSchedule";
import { StepSources } from "./StepSources";
import { StepZip } from "./StepZip";
import { StepOutputs } from "./StepOutputs";
import { StepValidate } from "./StepValidate";
import {
  type WizardForm,
  defaultForm,
  backupToForm,
  formToPayload,
} from "./backupWizard.utils";

const STEPS = [
  "backups.wizard.stepBasic",
  "backups.wizard.stepSchedule",
  "backups.wizard.stepSources",
  "backups.wizard.stepZip",
  "backups.wizard.stepOutputs",
  "backups.wizard.stepValidate",
] as const;

interface BackupWizardProps {
  initial?: Backup;
}

export function BackupWizard({ initial }: BackupWizardProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [backupId, setBackupId] = useState<string | null>(initial?.id ?? null);
  const [backup, setBackup] = useState<Backup | null>(initial ?? null);
  const [form, setForm] = useState<WizardForm>(() => initial ? backupToForm(initial) : defaultForm());
  const [isSaving, setIsSaving] = useState(false);

  // Lazy-loaded data for step 2 (sources) — HTTP vaults
  const [httpVaultItems, setHttpVaultItems] = useState<HttpVaultItem[]>([]);
  const [sourcesDataLoaded, setSourcesDataLoaded] = useState(false);

  // Lazy-loaded data for step 4 (outputs)
  const [vaultItems, setVaultItems] = useState<EmailVaultItem[]>([]);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [outputDataLoaded, setOutputDataLoaded] = useState(false);

  // Load HTTP vault list once when user reaches step 2
  useEffect(() => {
    if (step !== 2 || sourcesDataLoaded) return;
    vaultService.listHttp(undefined, 100).then((res) => {
      setHttpVaultItems(res.data);
      setSourcesDataLoaded(true);
    }).catch(() => { setSourcesDataLoaded(true); });
  }, [step]); // eslint-disable-line

  // Load output data once when user reaches step 4
  useEffect(() => {
    if (step !== 4 || outputDataLoaded) return;
    const load = async () => {
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
        // Hydrate contact objects in outputs if we have a backup
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
      setOutputDataLoaded(true);
    };
    void load();
  }, [step]); // eslint-disable-line

  const handleSave = useCallback(async () => {
    if (!form.basic.name.trim()) {
      toast.error(t("backups.errorNoName"));
      return;
    }
    setIsSaving(true);
    try {
      const payload = formToPayload(form, form.enabled);
      let saved: Backup;
      if (backupId) {
        saved = await backupsService.update(backupId, payload);
      } else {
        saved = await backupsService.create(payload);
        setBackupId(saved.id);
      }
      setBackup(saved);
      toast.success(backupId ? t("backups.updateSuccess") : t("backups.createSuccess"));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setIsSaving(false);
    }
  }, [form, backupId, t]);

  const handleEnableAndFinish = async () => {
    if (!backupId || !backup?.isValidated) return;
    setIsSaving(true);
    try {
      await backupsService.update(backupId, { enabled: true });
      toast.success(t("backups.enabledSuccess"));
      router.push("/backups");
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-0">
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-6">
        {STEPS.map((key, idx) => (
          <div key={key} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => { if (idx < step || backupId) setStep(idx); }}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                idx === step
                  ? "bg-primary text-primary-foreground"
                  : idx < step || backupId
                  ? "text-foreground hover:bg-muted cursor-pointer"
                  : "text-muted-foreground cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border",
                  idx === step
                    ? "border-primary-foreground/50"
                    : idx < step
                    ? "border-primary text-primary"
                    : "border-muted-foreground/30",
                )}
              >
                {idx + 1}
              </span>
              <span className="hidden sm:inline">{t(key)}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={cn("h-px flex-1 mx-1", idx < step ? "bg-primary/40" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[320px]">
        {step === 0 && (
          <StepBasic
            data={form.basic}
            enabled={form.enabled}
            isValidated={backup?.isValidated ?? false}
            onChange={(d) => setForm((f) => ({ ...f, basic: d }))}
            onEnabledChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
          />
        )}
        {step === 1 && (
          <StepSchedule
            data={form.schedule}
            onChange={(d) => setForm((f) => ({ ...f, schedule: d }))}
          />
        )}
        {step === 2 && (
          <StepSources
            data={form.sources}
            httpVaultItems={httpVaultItems}
            onChange={(d) => setForm((f) => ({ ...f, sources: d }))}
          />
        )}
        {step === 3 && (
          <StepZip
            data={form.zip}
            backupName={form.basic.name}
            onChange={(d) => setForm((f) => ({ ...f, zip: d }))}
          />
        )}
        {step === 4 && (
          <StepOutputs
            data={form.outputs}
            vaultItems={vaultItems}
            templates={templates}
            contacts={contacts}
            onChange={(d) => setForm((f) => ({ ...f, outputs: d }))}
          />
        )}
        {step === 5 && (
          <StepValidate
            backupId={backupId}
            backup={backup}
            sourcesCount={form.sources.length}
            onBackupUpdated={setBackup}
          />
        )}
      </div>

      <Separator className="my-6" />

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Save */}
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleSave()}
          disabled={isSaving || !form.basic.name.trim()}
        >
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {t("common.save")}
        </Button>

        {/* Right: nav */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/backups")}
          >
            {t("common.cancel")}
          </Button>

          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="size-3.5" />
              {t("common.back")}
            </Button>
          )}

          {step < STEPS.length - 1 && (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
            >
              {t("common.next")}
              <ChevronRight className="size-3.5" />
            </Button>
          )}

          {step === STEPS.length - 1 && backup?.isValidated && (
            <Button type="button" onClick={() => void handleEnableAndFinish()} disabled={isSaving}>
              {t("backups.wizard.enableAndFinish")}
            </Button>
          )}

          {step === STEPS.length - 1 && (
            <Button
              type="button"
              variant={backup?.isValidated ? "outline" : "default"}
              onClick={() => router.push("/backups")}
            >
              {t("backups.wizard.finishWithoutEnable")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
