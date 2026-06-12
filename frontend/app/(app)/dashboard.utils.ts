export function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatMonth(dateStr: string): string {
  return new Date(dateStr + "-01T00:00:00Z").toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function groupByMonth(
  rows: { date: string; success: number; error: number }[],
): { date: string; success: number; error: number }[] {
  const map = new Map<string, { success: number; error: number }>();
  for (const r of rows) {
    const month = r.date.slice(0, 7);
    const e = map.get(month) ?? { success: 0, error: 0 };
    map.set(month, { success: e.success + r.success, error: e.error + r.error });
  }
  return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
}
