import { api } from "@/lib/api";

export interface BackupSources {
  paths: string[];
  exclude: string[];
}

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
  createdAt: string;
  updatedAt: string;
}

export interface Backup {
  id: string;
  name: string;
  sources: BackupSources;
  compression: string;
  schedule: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  outputs: BackupOutput[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBackupOutputPayload {
  type: string;
  vaultId: string;
  templateId?: string;
  recipientsTo: string[];
  recipientsCc?: string[];
  recipientsBcc?: string[];
  overrideSubject?: string;
  overrideBody?: string;
  overrideBodyType?: string;
}

export interface CreateBackupPayload {
  name: string;
  sources: BackupSources;
  compression?: string;
  schedule?: string | null;
  enabled?: boolean;
  outputs?: CreateBackupOutputPayload[];
}

export type UpdateBackupPayload = Partial<CreateBackupPayload>;

export const backupsService = {
  list: () => api.get<Backup[]>("/api/backups"),
  create: (data: CreateBackupPayload) => api.post<Backup>("/api/backups", data),
  getOne: (id: string) => api.get<Backup>(`/api/backups/${id}`),
  update: (id: string, data: UpdateBackupPayload) =>
    api.patch<Backup>(`/api/backups/${id}`, data),
  delete: (id: string) => api.delete<null>(`/api/backups/${id}`),
  run: (id: string) => api.post<{ accepted: boolean }>(`/api/backups/${id}/run`),
};

export function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, month, dow] = parts;

  const hourNum = parseInt(hour);
  const minNum = parseInt(min);
  const isFixedTime = !isNaN(hourNum) && !isNaN(minNum);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = isFixedTime ? `${pad(hourNum)}:${pad(minNum)}` : null;

  if (hour === "*" && min === "0" && dom === "*" && month === "*" && dow === "*")
    return "Every hour";

  if (dom === "*" && month === "*" && dow === "*" && time)
    return `Every day at ${time}`;

  if (dom === "*" && month === "*" && dow !== "*" && time) {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayIndex = parseInt(dow);
    const dayName = !isNaN(dayIndex) ? days[dayIndex] : null;
    if (dayName) return `Every ${dayName} at ${time}`;
  }

  if (dom !== "*" && month === "*" && dow === "*" && time)
    return `Monthly on day ${dom} at ${time}`;

  if (dom === "1" && month === "*" && dow === "*" && time)
    return `1st of each month at ${time}`;

  return expr;
}
