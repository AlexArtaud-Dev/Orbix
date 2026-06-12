"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "react-i18next";
import { statsService, type StatsData, type StatsPeriod } from "@/services/stats";
import {
  HardDrive,
  CalendarClock,
  RefreshCw,
  Radio,
  CheckCircle2,
  Archive,
  Timer,
  Activity,
  Clock,
} from "lucide-react";

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

// ─── Chart configs — explicit semantic colors ─────────────────────────────────

const runsChartConfig = {
  success: { label: "Succès", color: "oklch(0.65 0.17 142)" },
  error: { label: "Erreurs", color: "oklch(0.65 0.22 27)" },
} satisfies ChartConfig;

const sizeChartConfig = {
  size: { label: "Taille", color: "oklch(0.6 0.15 220)" },
} satisfies ChartConfig;

const durationChartConfig = {
  duration: { label: "Durée", color: "oklch(0.6 0.18 290)" },
} satisfies ChartConfig;

const logsChartConfig = {
  error: { label: "ERROR", color: "oklch(0.65 0.22 27)" },
  warn: { label: "WARN", color: "oklch(0.72 0.18 80)" },
  info: { label: "INFO", color: "oklch(0.58 0.18 250)" },
  debug: { label: "DEBUG", color: "oklch(0.65 0.04 240)" },
} satisfies ChartConfig;

const errorsChartConfig = {
  count: { label: "Erreurs logs", color: "oklch(0.65 0.22 27)" },
} satisfies ChartConfig;

// ─── Period selector ──────────────────────────────────────────────────────────

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "7d", label: "7 j" },
  { value: "30d", label: "30 j" },
  { value: "365d", label: "1 an" },
];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-green-500/15 text-green-600 dark:text-green-400",
    error: "bg-red-500/15 text-red-600 dark:text-red-400",
    running: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  sub,
  loading,
  accent,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  loading?: boolean;
  accent?: "green" | "red" | "default";
}) {
  const accentClass =
    accent === "green"
      ? "text-green-600 dark:text-green-400"
      : accent === "red"
        ? "text-red-600 dark:text-red-400"
        : "";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className={`text-2xl font-bold ${accentClass}`}>{value}</p>
        )}
        {sub && <p className="mt-0.5 text-xs text-muted-foreground truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<StatsPeriod>("30d");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const liveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      return statsService
        .get(period)
        .then((res) => {
          setData(res);
          setLastRefresh(new Date());
        })
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [period],
  );

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    if (live) {
      liveRef.current = setInterval(() => void fetch(true), 10_000);
    } else {
      if (liveRef.current) clearInterval(liveRef.current);
    }
    return () => {
      if (liveRef.current) clearInterval(liveRef.current);
    };
  }, [live, fetch]);

  const lastSuccessRun = useMemo(
    () => data?.lastRuns.find((r) => r.status === "success") ?? null,
    [data],
  );

  const donutData = useMemo(() => {
    if (!data) return [];
    const s = data.periodStats.totalRuns > 0
      ? data.recentRuns.reduce((acc, r) => acc + r.success, 0)
      : 0;
    const e = data.periodStats.totalRuns > 0
      ? data.recentRuns.reduce((acc, r) => acc + r.error, 0)
      : 0;
    return [
      { name: "Succès", value: s, fill: "oklch(0.65 0.17 142)" },
      { name: "Erreurs", value: e, fill: "oklch(0.65 0.22 27)" },
    ];
  }, [data]);

  const runSizeData = useMemo(
    () =>
      [...(data?.lastRuns ?? [])]
        .reverse()
        .filter((r) => r.archiveSizeBytes !== null)
        .map((r) => ({ name: formatDate(r.startedAt), size: r.archiveSizeBytes ?? 0 })),
    [data],
  );

  const runDurationData = useMemo(
    () =>
      [...(data?.lastRuns ?? [])]
        .reverse()
        .filter((r) => r.durationMs !== null)
        .map((r) => ({ name: formatDate(r.startedAt), duration: r.durationMs ?? 0 })),
    [data],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">
            {t("dashboard.welcome")}, {user?.username}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          {live && lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Màj {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void fetch()}
            disabled={loading}
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>

          {/* Live toggle */}
          <Button
            variant={live ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setLive((v) => !v)}
          >
            <Radio className="size-3.5" />
            {live ? "Live ON" : "Live"}
          </Button>

          {/* Period selector */}
          <div className="flex gap-1 rounded-md border p-1">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2.5 text-xs"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI cards — period-based metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          title="Backups actifs"
          value={data ? `${data.counts.backupsActive} / ${data.counts.backupsTotal}` : "—"}
          icon={HardDrive}
          loading={loading}
        />
        <KpiCard
          title="Runs sur la période"
          value={data?.periodStats.totalRuns ?? "—"}
          icon={Activity}
          loading={loading}
        />
        <KpiCard
          title="Taux de succès"
          value={data ? `${data.periodStats.successRate}%` : "—"}
          icon={CheckCircle2}
          accent={
            data
              ? data.periodStats.successRate >= 90
                ? "green"
                : data.periodStats.successRate < 70
                  ? "red"
                  : "default"
              : "default"
          }
          loading={loading}
        />
        <KpiCard
          title="Taille moy. archives"
          value={formatSize(data?.periodStats.avgSizeBytes ?? null)}
          icon={Archive}
          loading={loading}
        />
        <KpiCard
          title="Durée moy. d'exécution"
          value={formatDuration(data?.periodStats.avgDurationMs ?? null)}
          icon={Timer}
          loading={loading}
        />
        <KpiCard
          title="Dernier run réussi"
          value={lastSuccessRun ? formatDate(lastSuccessRun.finishedAt) : "—"}
          icon={CalendarClock}
          sub={lastSuccessRun?.backupName}
          loading={loading}
        />
      </div>

      {/* Next scheduled */}
      {data?.nextScheduled && (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">Prochain run planifié :</span>
          <span className="font-medium">{data.nextScheduled.backupName}</span>
          <span className="text-muted-foreground">—</span>
          <span>{formatDate(data.nextScheduled.nextRunAt)}</span>
        </div>
      )}

      {/* Charts row 1: stacked runs + donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Exécutions par jour</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ChartContainer config={runsChartConfig} className="min-h-[200px] w-full">
                <BarChart accessibilityLayer data={data?.recentRuns ?? []}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    minTickGap={20}
                    tickFormatter={formatDay}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => formatDay(v as string)}
                      />
                    }
                  />
                  <Bar dataKey="success" stackId="runs" fill="var(--color-success)" radius={[0, 0, 2, 2]} />
                  <Bar dataKey="error" stackId="runs" fill="var(--color-error)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Résultats globaux
              {data && data.periodStats.totalRuns > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {data.periodStats.totalRuns} run{data.periodStats.totalRuns > 1 ? "s" : ""}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : donutData.every((d) => d.value === 0) ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucun run sur cette période</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ChartContainer config={runsChartConfig} className="h-[160px] w-[160px]">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={<ChartTooltipContent nameKey="name" hideLabel />}
                    />
                  </PieChart>
                </ChartContainer>
                <div className="flex gap-4 text-sm">
                  {donutData.map((entry) => {
                    const total = donutData.reduce((s, d) => s + d.value, 0);
                    const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                    return (
                      <div key={entry.name} className="flex items-center gap-1.5">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: entry.fill }} />
                        <span className="text-muted-foreground">{entry.name}</span>
                        <span className="font-medium">{entry.value}</span>
                        <span className="text-xs text-muted-foreground">({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: archive size + duration */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taille des archives (10 derniers)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : runSizeData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              <ChartContainer config={sizeChartConfig} className="min-h-[160px] w-full">
                <LineChart accessibilityLayer data={runSizeData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    tickMargin={6}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => formatSize(v)}
                    width={60}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v) => [formatSize(v as number), "Taille"]}
                        hideLabel
                      />
                    }
                  />
                  <Line
                    dataKey="size"
                    type="monotone"
                    stroke="var(--color-size)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--color-size)" }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Durée d'exécution (10 derniers)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : runDurationData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              <ChartContainer config={durationChartConfig} className="min-h-[160px] w-full">
                <BarChart accessibilityLayer data={runDurationData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    tickMargin={6}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => formatDuration(v)}
                    width={52}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v) => [formatDuration(v as number), "Durée"]}
                        hideLabel
                      />
                    }
                  />
                  <Bar dataKey="duration" fill="var(--color-duration)" radius={3} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 3: logs by level + errors by day */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Logs par niveau</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ChartContainer config={logsChartConfig} className="min-h-[200px] w-full">
                <LineChart accessibilityLayer data={data?.logsByLevel ?? []}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    minTickGap={20}
                    tickFormatter={formatDay}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => formatDay(v as string)}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line dataKey="error" type="monotone" stroke="var(--color-error)" strokeWidth={2} dot={false} />
                  <Line dataKey="warn" type="monotone" stroke="var(--color-warn)" strokeWidth={2} dot={false} />
                  <Line dataKey="info" type="monotone" stroke="var(--color-info)" strokeWidth={2} dot={false} />
                  <Line dataKey="debug" type="monotone" stroke="var(--color-debug)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Erreurs logs par jour</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ChartContainer config={errorsChartConfig} className="min-h-[200px] w-full">
                <BarChart accessibilityLayer data={data?.errorsByDay ?? []}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    minTickGap={20}
                    tickFormatter={formatDay}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => formatDay(v as string)}
                      />
                    }
                  />
                  <Bar dataKey="count" fill="var(--color-count)" radius={3} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Last runs table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Derniers runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !data?.lastRuns.length ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Activity className="size-8" />
              <p className="text-sm">Lance ton premier backup pour voir les runs ici.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Backup</th>
                    <th className="px-4 py-2 font-medium">Déclencheur</th>
                    <th className="px-4 py-2 font-medium">Début</th>
                    <th className="px-4 py-2 font-medium">Durée</th>
                    <th className="px-4 py-2 font-medium">Taille</th>
                    <th className="px-4 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lastRuns.map((run) => (
                    <tr key={run.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2 font-medium">{run.backupName}</td>
                      <td className="px-4 py-2 capitalize text-muted-foreground">
                        {run.triggerType}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(run.startedAt)}
                      </td>
                      <td className="px-4 py-2">{formatDuration(run.durationMs)}</td>
                      <td className="px-4 py-2">{formatSize(run.archiveSizeBytes)}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={run.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
