import type { LogCategory, LogLevel } from './logs.writer';

export interface ListLogsQuery {
  cursor?: string;
  limit?: number;
  category?: LogCategory;
  level?: LogLevel;
  from?: string;
  to?: string;
}
