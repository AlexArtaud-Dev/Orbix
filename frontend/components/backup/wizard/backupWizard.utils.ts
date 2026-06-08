import type { Backup, CreateBackupPayload, ScheduleConfigPayload } from "@/services/backups";
import type { StepBasicData } from "./StepBasic";
import type { StepScheduleData, ScheduleType } from "./StepSchedule";
import type { SourceFormItem } from "./StepSources";
import type { StepZipData } from "./StepZip";
import type { OutputFormItem } from "./StepOutputs";

export interface WizardForm {
  basic: StepBasicData;
  enabled: boolean;
  schedule: StepScheduleData;
  sources: SourceFormItem[];
  zip: StepZipData;
  outputs: OutputFormItem[];
}

export function defaultForm(): WizardForm {
  return {
    basic: { name: "" },
    enabled: false,
    schedule: {
      type: "manual",
      datetime: "",
      timezone: "UTC",
      days: [1, 2, 3, 4, 5],
      hour: 3,
      minute: 0,
      every: 1,
      unit: "hours",
    },
    sources: [],
    zip: { archiveFormat: "zip", zipCompression: "default", zipPassword: "", zipFilename: "" },
    outputs: [],
  };
}

export function backupToForm(backup: Backup): WizardForm {
  const cfg = backup.scheduleConfig as Record<string, unknown> | null;
  return {
    basic: { name: backup.name },
    enabled: backup.enabled,
    schedule: {
      type: (backup.scheduleType as ScheduleType) || "manual",
      datetime: cfg && "datetime" in cfg ? String(cfg.datetime) : "",
      timezone: cfg && "timezone" in cfg ? String(cfg.timezone) : "UTC",
      days: cfg && "days" in cfg && Array.isArray(cfg.days) ? (cfg.days as number[]) : [1, 2, 3, 4, 5],
      hour: cfg && "hour" in cfg ? Number(cfg.hour) : 3,
      minute: cfg && "minute" in cfg ? Number(cfg.minute) : 0,
      every: cfg && "every" in cfg ? Number(cfg.every) : 1,
      unit: cfg && "unit" in cfg ? (String(cfg.unit) as "minutes" | "hours") : "hours",
    },
    sources: backup.sources.sources.map((s) => ({
      path: s.path,
      type: s.type,
      exclude: s.exclude || [],
      vaultId: s.vaultId,
      requestParams: s.requestParams,
      transferMode: s.transferMode,
      inputId: s.inputId,
    })),
    zip: {
      archiveFormat: (backup.archiveFormat as "zip" | "tar" | "tar-gz" | "tar-bz2") || "zip",
      zipCompression: (backup.zipCompression as "store" | "fast" | "default" | "best") || "default",
      // null = existing password, do not overwrite; "" = no password
      zipPassword: backup.zipPassword ? null : "",
      zipFilename: backup.zipFilename || "",
    },
    outputs: backup.outputs.map((o) => ({
      dndId: o.id,
      type: "mail" as const,
      vaultId: o.vaultId,
      templateId: o.templateId || "",
      // Stub contacts with IDs so the payload is correct even before step 4 is visited
      recipientsTo: o.recipientsTo.map((id) => ({ id, name: "", email: "", tags: [], createdAt: "", updatedAt: "" })),
      recipientsCc: o.recipientsCc.map((id) => ({ id, name: "", email: "", tags: [], createdAt: "", updatedAt: "" })),
      recipientsBcc: o.recipientsBcc.map((id) => ({ id, name: "", email: "", tags: [], createdAt: "", updatedAt: "" })),
      overrideSubject: o.overrideSubject || "",
      overrideBody: o.overrideBody || "",
      overrideBodyType: (o.overrideBodyType as "text" | "html") || "text",
    })),
  };
}

export function buildScheduleString(s: StepScheduleData): string | null {
  switch (s.type) {
    case "manual": return null;
    case "oneshoot": return s.datetime || null;
    case "recurring": {
      const days = s.days.length === 0 ? "*" : s.days.join(",");
      return `${s.minute} ${s.hour} * * ${days}`;
    }
    case "interval":
      return s.unit === "minutes"
        ? `*/${Math.max(1, s.every)} * * * *`
        : `0 */${Math.max(1, s.every)} * * *`;
  }
}

export function buildScheduleConfig(s: StepScheduleData): ScheduleConfigPayload {
  switch (s.type) {
    case "manual": return null;
    case "oneshoot": return { datetime: s.datetime, timezone: s.timezone };
    case "recurring": return { days: s.days, hour: s.hour, minute: s.minute, timezone: s.timezone };
    case "interval": return { every: s.every, unit: s.unit };
  }
}

export function formToPayload(form: WizardForm, enabled: boolean): CreateBackupPayload {
  return {
    name: form.basic.name,
    enabled,
    scheduleType: form.schedule.type,
    scheduleConfig: buildScheduleConfig(form.schedule),
    schedule: buildScheduleString(form.schedule),
    sources: {
      sources: form.sources.map((s) => ({
        path: s.path,
        type: s.type,
        exclude: s.exclude,
        vaultId: s.type === "url" ? s.vaultId : undefined,
        requestParams: s.requestParams?.length ? s.requestParams : undefined,
        transferMode: s.type === "url" ? (s.transferMode ?? "stream") : undefined,
        inputId: s.type === "input" ? s.inputId : undefined,
      })),
    },
    archiveFormat: form.zip.archiveFormat,
    zipCompression: form.zip.zipCompression,
    // null = unchanged (edit mode), send undefined so backend keeps existing value
    // "" = explicitly no password, send null to clear
    zipPassword: form.zip.zipPassword === null ? undefined : (form.zip.zipPassword || null),
    zipFilename: form.zip.zipFilename || null,
    outputs: form.outputs.map((o, i) => ({
      type: o.type,
      vaultId: o.vaultId,
      templateId: o.templateId || undefined,
      recipientsTo: o.recipientsTo.map((c) => c.id),
      recipientsCc: o.recipientsCc.map((c) => c.id),
      recipientsBcc: o.recipientsBcc.map((c) => c.id),
      overrideSubject: o.overrideSubject || undefined,
      overrideBody: o.overrideBody || undefined,
      overrideBodyType: o.overrideBody ? o.overrideBodyType : undefined,
      order: i,
    })),
  };
}
