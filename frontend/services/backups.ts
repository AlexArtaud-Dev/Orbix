import { api } from "@/lib/api";

export interface RequestParam {
  in: "header" | "query" | "body";
  key: string;
  valueType: "literal" | "vault";
  value?: string;
  vaultId?: string;
  vaultField?: string;
}

export interface BackupSource {
  path: string;
  type: "file" | "folder" | "url" | "input";
  exclude: string[];
  vaultId?: string;
  requestParams?: RequestParam[];
  transferMode?: "stream" | "buffer";
  inputId?: string;
}

export interface BackupSourcesPayload {
  sources: BackupSource[];
}

export interface OneshotConfig {
  datetime: string;
  timezone: string;
}
export interface RecurringConfig {
  days: number[];
  hour: number;
  minute: number;
  timezone: string;
}
export interface IntervalConfig {
  every: number;
  unit: "minutes" | "hours";
}
export type ScheduleConfigPayload = OneshotConfig | RecurringConfig | IntervalConfig | null;

export interface BackupOutput {
  id: string;
  backupId: string;
  type: string;
  vaultId: string;
  templateId: string | null;
  recipientsTo: string[];
  recipientsCc: string[];
  recipientsBcc: string[];
  overrideSubject: string | null;
  overrideBody: string | null;
  overrideBodyType: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Backup {
  id: string;
  name: string;
  backupType: "local" | "input";
  sources: BackupSourcesPayload;
  scheduleType: string;
  scheduleConfig: ScheduleConfigPayload;
  schedule: string | null;
  enabled: boolean;
  noArchive: boolean;
  archiveFormat: string;
  zipCompression: string;
  zipPassword: string | null;
  zipPasswordVaultRef: string | null;
  zipFilename: string | null;
  isValidated: boolean;
  validationStatus: string | null;
  validationError: string | null;
  validatedAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  outputs: BackupOutput[];
  createdAt: string;
  updatedAt: string;
}

export interface BackupOutputPayload {
  type: string;
  vaultId: string;
  templateId?: string;
  recipientsTo?: string[];
  recipientsCc?: string[];
  recipientsBcc?: string[];
  overrideSubject?: string;
  overrideBody?: string;
  overrideBodyType?: string;
  order?: number;
}

export interface CreateBackupPayload {
  name: string;
  backupType?: "local" | "input";
  noArchive?: boolean;
  enabled?: boolean;
  scheduleType?: string;
  scheduleConfig?: ScheduleConfigPayload;
  schedule?: string | null;
  sources?: BackupSourcesPayload;
  archiveFormat?: string;
  zipCompression?: string;
  zipPassword?: string | null;
  zipPasswordVaultRef?: string | null;
  zipFilename?: string | null;
  outputs?: BackupOutputPayload[];
}

export type UpdateBackupPayload = Partial<CreateBackupPayload>;

export interface ZipInfo {
  basic: boolean;
  encrypted: boolean;
  tarBz2: boolean;
  platform: string;
  node: string;
}

export interface ZipTestResult {
  success: boolean;
  durationMs: number;
  sizeBytes: number;
  error?: string;
}

export const backupsService = {
  list: () => api.get<Backup[]>("/api/backups"),
  create: (data: CreateBackupPayload) => api.post<Backup>("/api/backups", data),
  getOne: (id: string) => api.get<Backup>(`/api/backups/${id}`),
  update: (id: string, data: UpdateBackupPayload) =>
    api.patch<Backup>(`/api/backups/${id}`, data),
  delete: (id: string) => api.delete<null>(`/api/backups/${id}`),
  run: (id: string) => api.post<{ accepted: boolean }>(`/api/backups/${id}/run`),
  validate: (id: string) => api.post<{ accepted: boolean }>(`/api/backups/${id}/validate`),
  getZipInfo: () => api.get<ZipInfo>("/api/backups/zip-info"),
  testZip: () => api.post<ZipTestResult>("/api/backups/zip-test"),
};

export function describeSchedule(backup: Pick<Backup, "scheduleType" | "scheduleConfig" | "schedule">): string {
  const cfg = backup.scheduleConfig as Record<string, unknown> | null;
  switch (backup.scheduleType) {
    case "manual": return "Manual only";
    case "oneshoot": {
      const dt = cfg && "datetime" in cfg ? String(cfg.datetime) : backup.schedule;
      if (!dt) return "One-shot";
      try {
        return `Once — ${new Date(dt).toLocaleString()}`;
      } catch {
        return "One-shot";
      }
    }
    case "recurring": {
      const days = cfg && "days" in cfg && Array.isArray(cfg.days) ? (cfg.days as number[]) : [];
      const hour = cfg && "hour" in cfg ? Number(cfg.hour) : 0;
      const minute = cfg && "minute" in cfg ? Number(cfg.minute) : 0;
      const tz = cfg && "timezone" in cfg ? ` (${String(cfg.timezone)})` : "";
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const daysStr = days.length === 7 ? "Every day" : days.map((d) => dayNames[d] ?? d).join(", ");
      const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      return `${daysStr} at ${time}${tz}`;
    }
    case "interval": {
      const every = cfg && "every" in cfg ? Number(cfg.every) : 1;
      const unit = cfg && "unit" in cfg ? String(cfg.unit) : "hours";
      return `Every ${every} ${unit}`;
    }
    default: return backup.schedule ?? "Manual only";
  }
}
