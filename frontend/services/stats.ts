import { api } from "@/lib/api";

export type StatsPeriod = "7d" | "30d" | "365d";

export interface StatsCounts {
  backupsActive: number;
  backupsTotal: number;
  inputs: number;
  vaultHttp: number;
  vaultEmail: number;
  contacts: number;
}

export interface RunsByDay {
  date: string;
  success: number;
  error: number;
}

export interface LastRun {
  id: string;
  backupName: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  archiveSizeBytes: number | null;
  durationMs: number | null;
  triggerType: string;
}

export interface NextScheduled {
  backupId: string;
  backupName: string;
  nextRunAt: string;
}

export interface LogsByLevel {
  date: string;
  debug: number;
  info: number;
  warn: number;
  error: number;
}

export interface ErrorsByDay {
  date: string;
  count: number;
}

export interface StatsData {
  counts: StatsCounts;
  recentRuns: RunsByDay[];
  lastRuns: LastRun[];
  nextScheduled: NextScheduled | null;
  logsByLevel: LogsByLevel[];
  errorsByDay: ErrorsByDay[];
}

export const statsService = {
  get(period: StatsPeriod = "30d"): Promise<StatsData> {
    return api.get<StatsData>(`/api/stats?period=${period}`);
  },
};
