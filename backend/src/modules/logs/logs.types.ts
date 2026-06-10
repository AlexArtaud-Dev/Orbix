export interface ListLogsQuery {
  cursor?: string; // Log.id for cursor pagination
  limit?: number;
  category?: string | string[];
  level?: string | string[];
  backupId?: string;
  from?: string; // ISO datetime
  to?: string; // ISO datetime
}
