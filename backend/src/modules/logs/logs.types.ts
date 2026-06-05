import type { LogCategory, LogLevel } from './logs.writer';

export interface ListLogsQuery {
  cursor?: string;   // Log.id for cursor pagination
  limit?: number;
  category?: LogCategory;
  level?: LogLevel;
  backupId?: string;
  from?: string;     // ISO datetime
  to?: string;       // ISO datetime
}
