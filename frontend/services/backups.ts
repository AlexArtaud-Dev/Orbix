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
  timezone: string;
  // New multi-rule format
  rules?: Array<{ days: number[]; hour: number; minute: number }>;
  // Legacy flat format (backward compat)
  days?: number[];
  hour?: number;
  minute?: number;
}
export interface IntervalConfig {
  every: number;
  unit: "minutes" | "hours";
  startDate?: string;
  endDate?: string;
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
  pathOverride: string | null;
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
  pathOverride?: string;
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
      const tz = cfg && "timezone" in cfg ? ` (${String(cfg.timezone)})` : "";
      // day 0 = Sun, kept last in display (Mon…Sat, Sun)
      const dayNames: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
      const fmtDays = (days: number[]) =>
        days.length === 0 || days.length === 7
          ? "Every day"
          : days.map((d) => dayNames[d] ?? String(d)).join(", ");
      const fmtTime = (h: number, m: number) =>
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      // New format: { rules: [{ days, hour, minute }] }
      const rules =
        cfg && "rules" in cfg && Array.isArray(cfg.rules) && cfg.rules.length > 0
          ? (cfg.rules as Array<{ days: number[]; hour: number; minute: number }>)
          : null;

      if (rules) {
        const parts = rules.map((r) => `${fmtDays(r.days)} at ${fmtTime(r.hour, r.minute)}`);
        const joined = parts.join(" · ");
        return joined.length <= 72 ? `${joined}${tz}` : `${rules.length} time slots${tz}`;
      }

      // Legacy flat format
      const days = cfg && "days" in cfg && Array.isArray(cfg.days) ? (cfg.days as number[]) : [];
      const hour = cfg && "hour" in cfg ? Number(cfg.hour) : 0;
      const minute = cfg && "minute" in cfg ? Number(cfg.minute) : 0;
      return `${fmtDays(days)} at ${fmtTime(hour, minute)}${tz}`;
    }
    case "interval": {
      const every = cfg && "every" in cfg ? Number(cfg.every) : 1;
      const unit = cfg && "unit" in cfg ? String(cfg.unit) : "hours";
      const startDate = cfg && "startDate" in cfg ? String(cfg.startDate) : null;
      const endDate = cfg && "endDate" in cfg ? String(cfg.endDate) : null;
      let label = `Every ${every} ${unit}`;
      if (startDate) label += ` from ${new Date(startDate).toLocaleDateString()}`;
      if (endDate) label += ` to ${new Date(endDate).toLocaleDateString()}`;
      return label;
    }
    default: return backup.schedule ?? "Manual only";
  }
}

// ── Next-run computation ──────────────────────────────────────────────────────

function _getTzOffsetMs(date: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    let h = get("hour");
    if (h === 24) h = 0;
    const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
    return localMs - date.getTime();
  } catch {
    return 0;
  }
}

function _weekdayInTz(date: Date, tz: string): number {
  try {
    const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(date);
    return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[short] ?? 0;
  } catch {
    return date.getDay();
  }
}

function _dateAtTimeInTz(date: Date, hour: number, minute: number, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const approx = Date.UTC(get("year"), get("month") - 1, get("day"), hour, minute, 0);
    return approx - _getTzOffsetMs(new Date(approx), tz);
  } catch {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  }
}

function _nextRecurring(
  rule: { days: number[]; hour: number; minute: number },
  tz: string,
  nowMs: number,
): Date | null {
  const active = rule.days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : rule.days;
  for (let offset = 0; offset <= 7; offset++) {
    const probe = new Date(nowMs + offset * 86_400_000);
    if (!active.includes(_weekdayInTz(probe, tz))) continue;
    const targetMs = _dateAtTimeInTz(probe, rule.hour, rule.minute, tz);
    if (targetMs > nowMs) return new Date(targetMs);
  }
  return null;
}

function _nextInterval(schedule: string, nowMs: number): Date | null {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour] = parts;

  const minEvery = min.match(/^\*\/(\d+)$/);
  if (minEvery && hour === "*") {
    const every = parseInt(minEvery[1]);
    if (every < 1) return null;
    const iv = every * 60_000;
    const rem = nowMs % iv;
    return new Date(rem === 0 ? nowMs + iv : nowMs + (iv - rem));
  }

  const hourEvery = hour.match(/^\*\/(\d+)$/);
  if (min === "0" && hourEvery) {
    const every = parseInt(hourEvery[1]);
    if (every < 1) return null;
    const iv = every * 3_600_000;
    const rem = nowMs % iv;
    return new Date(rem === 0 ? nowMs + iv : nowMs + (iv - rem));
  }

  return null;
}

export function computeNextRun(
  backup: Pick<Backup, "scheduleType" | "scheduleConfig" | "schedule" | "enabled">,
): Date | null {
  if (!backup.enabled) return null;
  const cfg = backup.scheduleConfig as Record<string, unknown> | null;
  const now = Date.now();

  switch (backup.scheduleType) {
    case "manual": return null;

    case "oneshoot": {
      const dt = cfg?.datetime != null ? String(cfg.datetime) : null;
      if (!dt) return null;
      const d = new Date(dt);
      return d.getTime() > now ? d : null;
    }

    case "recurring": {
      const tz = cfg?.timezone != null ? String(cfg.timezone) : "UTC";
      const rules =
        Array.isArray(cfg?.rules) && (cfg!.rules as unknown[]).length > 0
          ? (cfg!.rules as Array<{ days: number[]; hour: number; minute: number }>)
          : cfg?.hour != null
          ? [{ days: Array.isArray(cfg?.days) ? (cfg!.days as number[]) : [], hour: Number(cfg!.hour), minute: Number(cfg?.minute ?? 0) }]
          : [];
      if (rules.length === 0) return null;
      const candidates = rules.flatMap((r) => { const d = _nextRecurring(r, tz, now); return d ? [d] : []; });
      if (candidates.length === 0) return null;
      return candidates.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
    }

    case "interval":
      return backup.schedule ? _nextInterval(backup.schedule, now) : null;

    default: return null;
  }
}

export function formatNextRun(date: Date): string {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "";
  if (ms < 60_000) return "< 1 min";
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    return `${m} min`;
  }
  if (ms < 86_400_000) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return date.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
