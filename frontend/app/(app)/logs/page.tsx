"use client";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { logsService, type LogEntry, type LogCategory, type LogLevel } from "@/services/logs";
import { formatDate } from "@/lib/utils";

const LEVELS: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];
const CATEGORIES: LogCategory[] = ["auth", "backup", "mail", "scheduler", "system", "vault"];

const levelColors: Record<LogLevel, string> = {
  DEBUG: "bg-muted text-muted-foreground",
  INFO: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  WARN: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  ERROR: "bg-red-500/20 text-red-600 dark:text-red-400",
};

const selectCls =
  "h-9 rounded-md border bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

export default function LogsPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<LogCategory | "all">("all");
  const [level, setLevel] = useState<LogLevel | "all">("all");

  const load = useCallback(
    async (reset = true) => {
      setLoading(true);
      try {
        const result = await logsService.list({
          category: category !== "all" ? category : undefined,
          level: level !== "all" ? level : undefined,
          limit: 50,
          cursor: reset ? undefined : (nextCursor ?? undefined),
        });
        setEntries((prev) => (reset ? result.data : [...prev, ...result.data]));
        setNextCursor(result.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, level],
  );

  useEffect(() => { void load(true); }, [category, level]); // eslint-disable-line

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("logs.title")}</h1>
        <p className="text-muted-foreground">{t("logs.subtitle")}</p>
      </div>

      <div className="flex gap-3">
        <select className={selectCls} value={category}
          onChange={(e) => setCategory(e.target.value as LogCategory | "all")}>
          <option value="all">{t("logs.allCategories")}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={selectCls} value={level}
          onChange={(e) => setLevel(e.target.value as LogLevel | "all")}>
          <option value="all">{t("logs.allLevels")}</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        {entries.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">{t("logs.noLogs")}</p>
        )}
        {entries.map((entry, i) => (
          <LogRow key={`${entry.ts}-${i}`} entry={entry} />
        ))}
      </div>

      {nextCursor && (
        <button onClick={() => void load(false)} disabled={loading}
          className="rounded-md border px-4 py-1.5 text-sm hover:bg-accent disabled:opacity-50">
          {loading ? t("common.loading") : t("logs.loadMore")}
        </button>
      )}
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(!open)}
      className="cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">{formatDate(entry.ts)}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold shrink-0 ${levelColors[entry.level]}`}>
          {entry.level}
        </span>
        <span className="rounded border px-1.5 py-0.5 text-xs shrink-0">{entry.category}</span>
        <span className="font-mono text-xs text-muted-foreground shrink-0">{entry.code}</span>
        <span className="flex-1">{entry.msg}</span>
      </div>
      {open && entry.detail && (
        <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-xs text-muted-foreground">
          {entry.detail}
        </pre>
      )}
    </div>
  );
}
