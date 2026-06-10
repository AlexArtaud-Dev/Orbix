import { api } from "@/lib/api";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
export type LogCategory = string;

export interface LogEntry {
  ts: string;
  level: LogLevel;
  category: LogCategory;
  code: string;
  msg: string;
  detail?: string;
  backupId?: string;
}

export interface LogsResponse {
  data: LogEntry[];
  nextCursor: string | null;
}

export interface LogsQuery {
  cursor?: string;
  limit?: number;
  category?: string | string[];
  level?: LogLevel | LogLevel[];
  backupId?: string;
  from?: string;
  to?: string;
}

export interface BackupErrorSummary {
  totalErrors: number;
  affectedBackups: number;
}

export const logsService = {
  list: (query: LogsQuery = {}) => {
    const params = new URLSearchParams();
    if (query.cursor) params.set("cursor", query.cursor);
    if (query.limit) params.set("limit", String(query.limit));
    if (query.category) {
      const cats = Array.isArray(query.category) ? query.category : [query.category];
      cats.forEach((c) => params.append("category", c));
    }
    if (query.level) {
      const lvls = Array.isArray(query.level) ? query.level : [query.level];
      lvls.forEach((l) => params.append("level", l));
    }
    if (query.backupId) params.set("backupId", query.backupId);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    const qs = params.toString();
    return api.get<LogsResponse>(`/api/logs${qs ? `?${qs}` : ""}`);
  },

  listCategories: () => api.get<string[]>("/api/logs/categories"),

  getBackupErrorSummary: () =>
    api.get<BackupErrorSummary>("/api/logs/backup-error-summary"),

  getBackupLogs: (backupId: string, limit = 50) =>
    api.get<LogEntry[]>(`/api/logs/backup/${backupId}?limit=${limit}`),

  clearBackupLogs: (backupId: string) =>
    api.delete<{ cleared: boolean }>(`/api/logs/backup/${backupId}`),
};
