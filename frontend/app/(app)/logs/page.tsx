"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { logsService, type LogEntry, type LogCategory, type LogLevel } from "@/services/logs";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEVELS: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];
const CATEGORIES: LogCategory[] = ["auth", "backup", "mail", "scheduler", "system", "vault"];
const LIVE_INTERVAL_MS = 4000;

const levelColors: Record<LogLevel, string> = {
  DEBUG: "bg-muted text-muted-foreground",
  INFO:  "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  WARN:  "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  ERROR: "bg-red-500/20 text-red-600 dark:text-red-400",
};

export default function LogsPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<LogCategory | "all">("all");
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [live, setLive] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setNextCursor(reset ? result.nextCursor : result.nextCursor);
        if (reset) setLastRefreshed(new Date());
      } finally {
        setLoading(false);
      }
    },
    [category, level, nextCursor],
  );

  // Keep a ref to the latest load so the interval always uses fresh filters
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  // Load on filter change
  useEffect(() => { void load(true); }, [category, level]); // eslint-disable-line

  // Start/stop live interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (live) {
      intervalRef.current = setInterval(() => {
        void loadRef.current(true);
      }, LIVE_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [live]);

  // Stop live mode when filters change (restart cleanly)
  const handleCategoryChange = (v: string) => {
    setLive(false);
    setCategory(v as LogCategory | "all");
  };
  const handleLevelChange = (v: string) => {
    setLive(false);
    setLevel(v as LogLevel | "all");
  };

  const toggleLive = () => {
    const next = !live;
    setLive(next);
    if (next) void load(true); // immediate refresh when enabling
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("logs.title")}</h1>
        <p className="text-muted-foreground">{t("logs.subtitle")}</p>
      </div>

      {/* Filters + live button */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={category} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("logs.allCategories")}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={level} onValueChange={handleLevelChange}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("logs.allLevels")}</SelectItem>
            {LEVELS.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Live toggle */}
        <button
          type="button"
          onClick={toggleLive}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            live
              ? "border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400"
              : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
          )}
        >
          {/* Pulsing dot */}
          <span className="relative flex size-2 shrink-0">
            {live && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                live ? "bg-green-500" : "bg-muted-foreground/40",
              )}
            />
          </span>
          {t("logs.live")}
        </button>

        {/* Last refreshed */}
        {lastRefreshed && (
          <span className="text-xs text-muted-foreground">
            {t("logs.lastRefreshed")} {lastRefreshed.toLocaleTimeString()}
          </span>
        )}

        {/* Manual refresh */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void load(true)}
          disabled={loading}
        >
          {loading && !live ? t("common.loading") : t("logs.refresh")}
        </Button>
      </div>

      {/* Entries */}
      <div className="space-y-1">
        {entries.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">{t("logs.noLogs")}</p>
        )}
        {entries.map((entry, i) => (
          <LogRow key={`${entry.ts}-${i}`} entry={entry} />
        ))}
      </div>

      {/* Load more — hidden in live mode */}
      {nextCursor && !live && (
        <Button variant="outline" size="sm" onClick={() => void load(false)} disabled={loading}>
          {loading ? t("common.loading") : t("logs.loadMore")}
        </Button>
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
