import { api } from "@/lib/api";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
export type LogCategory =
  | "auth"
  | "backup"
  | "mail"
  | "scheduler"
  | "system"
  | "vault";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  category: LogCategory;
  code: string;
  msg: string;
  detail?: string;
}

export interface LogsResponse {
  data: LogEntry[];
  nextCursor: string | null;
}

export interface LogsQuery {
  cursor?: string;
  limit?: number;
  category?: LogCategory;
  level?: LogLevel;
  from?: string;
  to?: string;
}

export const logsService = {
  list: (query: LogsQuery = {}) => {
    const params = new URLSearchParams();
    if (query.cursor) params.set("cursor", query.cursor);
    if (query.limit) params.set("limit", String(query.limit));
    if (query.category) params.set("category", query.category);
    if (query.level) params.set("level", query.level);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    const qs = params.toString();
    return api.get<LogsResponse>(`/api/logs${qs ? `?${qs}` : ""}`);
  },
};
