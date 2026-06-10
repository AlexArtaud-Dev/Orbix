"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";
import { logsService, type LogEntry, type LogLevel } from "@/services/logs";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

const LEVELS: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];
const LIVE_INTERVAL_MS = 4000;

const levelColors: Record<LogLevel, string> = {
  DEBUG: "bg-muted text-muted-foreground",
  INFO:  "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  WARN:  "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  ERROR: "bg-red-500/20 text-red-600 dark:text-red-400",
};

// ── Generic multi-select filter component ─────────────────────────────────────

interface MultiFilterProps {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  onClear: () => void;
  renderItem?: (item: string) => React.ReactNode;
}

function MultiFilter({ label, items, selected, onToggle, onClear, renderItem }: MultiFilterProps) {
  const allSelected = selected.length === 0 || selected.length === items.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 font-normal">
          {allSelected ? label : `${label} (${selected.length})`}
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-36 gap-0 p-1">
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{label}</p>
        <Separator className="my-1" />
        {items.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">—</p>
        )}
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors"
          >
            <span className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-sm border",
              selected.includes(item)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/30",
            )}>
              {selected.includes(item) && <Check className="size-3" />}
            </span>
            {renderItem ? renderItem(item) : <span className="capitalize">{item}</span>}
          </button>
        ))}
        {selected.length > 0 && (
          <>
            <Separator className="my-1" />
            <button
              type="button"
              className="w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground text-left transition-colors rounded"
              onClick={onClear}
            >
              Clear filter
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [live, setLive] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch distinct categories once on mount, then refresh after each load
  const refreshCategories = useCallback(() => {
    logsService.listCategories().then(setCategories).catch(() => null);
  }, []);

  useEffect(() => { refreshCategories(); }, []); // eslint-disable-line

  const load = useCallback(
    async (reset = true) => {
      setLoading(true);
      try {
        const result = await logsService.list({
          category: selectedCategories.length > 0 ? selectedCategories : undefined,
          level: selectedLevels.length > 0 ? selectedLevels : undefined,
          limit: 50,
          cursor: reset ? undefined : (nextCursor ?? undefined),
        });
        setEntries((prev) => (reset ? result.data : [...prev, ...result.data]));
        setNextCursor(result.nextCursor);
        if (reset) {
          setLastRefreshed(new Date());
          refreshCategories(); // keep the list up-to-date
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedCategories, selectedLevels, nextCursor, refreshCategories],
  );

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  // Reload on filter change
  useEffect(() => { void load(true); }, [selectedCategories, selectedLevels]); // eslint-disable-line

  // Live mode
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (live) {
      intervalRef.current = setInterval(() => { void loadRef.current(true); }, LIVE_INTERVAL_MS);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [live]);

  const toggleCategory = (cat: string) => {
    setLive(false);
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const toggleLevel = (lvl: string) => {
    setLive(false);
    setSelectedLevels((prev) => {
      const l = lvl as LogLevel;
      return prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l];
    });
  };

  const toggleLive = () => {
    const next = !live;
    setLive(next);
    if (next) void load(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("logs.title")}</h1>
        <p className="text-muted-foreground">{t("logs.subtitle")}</p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">

        <MultiFilter
          label={t("logs.allCategories")}
          items={categories}
          selected={selectedCategories}
          onToggle={toggleCategory}
          onClear={() => { setLive(false); setSelectedCategories([]); }}
        />

        <MultiFilter
          label={t("logs.allLevels")}
          items={LEVELS}
          selected={selectedLevels}
          onToggle={toggleLevel}
          onClear={() => { setLive(false); setSelectedLevels([]); }}
          renderItem={(lvl) => (
            <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", (levelColors as Record<string, string>)[lvl] ?? "bg-muted text-muted-foreground")}>
              {lvl}
            </span>
          )}
        />

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
          <span className="relative flex size-2 shrink-0">
            {live && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
            )}
            <span className={cn("relative inline-flex size-2 rounded-full", live ? "bg-green-500" : "bg-muted-foreground/40")} />
          </span>
          {t("logs.live")}
        </button>

        {lastRefreshed && (
          <span className="text-xs text-muted-foreground">
            {t("logs.lastRefreshed")} {lastRefreshed.toLocaleTimeString()}
          </span>
        )}

        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void load(true)} disabled={loading}>
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
  const levelColor = (levelColors as Record<string, string>)[entry.level] ?? "bg-muted text-muted-foreground";
  return (
    <div
      onClick={() => setOpen(!open)}
      className="cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">{formatDate(entry.ts)}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold shrink-0 ${levelColor}`}>
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
