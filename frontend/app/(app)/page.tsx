"use client";
import { useState, useEffect, useMemo } from "react";
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
  Archive,
  CheckCircle2,
  Globe,
  HardDrive,
  Mail,
  Users,
  Clock,
  CalendarClock,
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
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

// ─── Chart configs ────────────────────────────────────────────────────────────

const runsChartConfig = {
  success: { label: "Succès", color: "var(--chart-2)" },
  error: { label: "Erreurs", color: "var(--chart-1)" },
} satisfies ChartConfig;

const sizeChartConfig = {
  size: { label: "Taille", color: "var(--chart-3)" },
} satisfies ChartConfig;

const durationChartConfig = {
  duration: { label: "Durée (ms)", color: "var(--chart-4)" },
} satisfies ChartConfig;

const logsChartConfig = {
  error: { label: "ERROR", color: "var(--chart-1)" },
  warn: { label: "WARN", color: "var(--chart-5)" },
  info: { label: "INFO", color: "var(--chart-2)" },
  debug: { label: "DEBUG", color: "var(--chart-3)" },
} satisfies ChartConfig;

const errorsChartConfig = {
  count: { label: "Erreurs", color: "var(--chart-1)" },
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
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
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

  useEffect(() => {
    setLoading(true);
    statsService
      .get(period)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [period]);

  const lastSuccessRun = useMemo(
    () => data?.lastRuns.find((r) => r.status === "success") ?? null,
    [data],
  );

  const donutData = useMemo(() => {
    if (!data) return [];
    const total = data.recentRuns.reduce(
      (acc, r) => ({ success: acc.success + r.success, error: acc.error + r.error }),
      { success: 0, error: 0 },
    );
    return [
      { name: "Succès", value: total.success, fill: "var(--chart-2)" },
      { name: "Erreurs", value: total.error, fill: "var(--chart-1)" },
    ];
  }, [data]);

  const runSizeData = useMemo(
    () =>
      [...(data?.lastRuns ?? [])]
        .reverse()
        .filter((r) => r.archiveSizeBytes !== null)
        .map((r) => ({
          name: formatDate(r.startedAt),
          size: r.archiveSizeBytes ?? 0,
        })),
    [data],
  );

  const runDurationData = useMemo(
    () =>
      [...(data?.lastRuns ?? [])]
        .reverse()
        .filter((r) => r.durationMs !== null)
        .map((r) => ({
          name: formatDate(r.startedAt),
          duration: r.durationMs ?? 0,
        })),
    [data],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">
            {t("dashboard.welcome")}, {user?.username}.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border p-1">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          title="Backups actifs"
          value={
            data ? `${data.counts.backupsActive} / ${data.counts.backupsTotal}` : "—"
          }
          icon={HardDrive}
          loading={loading}
        />
        <KpiCard
          title="Inputs"
          value={data?.counts.inputs ?? "—"}
          icon={Globe}
          loading={loading}
        />
        <KpiCard
          title="Vault HTTP"
          value={data?.counts.vaultHttp ?? "—"}
          icon={CheckCircle2}
          loading={loading}
        />
        <KpiCard
          title="Vault Email"
          value={data?.counts.vaultEmail ?? "—"}
          icon={Mail}
          loading={loading}
        />
        <KpiCard
          title="Contacts"
          value={data?.counts.contacts ?? "—"}
          icon={Users}
          loading={loading}
        />
        <KpiCard
          title="Dernier backup réussi"
          value={lastSuccessRun ? formatDate(lastSuccessRun.finishedAt) : "—"}
          icon={CalendarClock}
          loading={loading}
          sub={lastSuccessRun?.backupName}
        />
      </div>

      {/* Next scheduled */}
      {data?.nextScheduled && (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Clock className="size-4 text-muted-foreground" />
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Résultats globaux</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : donutData.every((d) => d.value === 0) ? (
              <p className="py-12 text-sm text-muted-foreground">Aucun run sur cette période</p>
            ) : (
              <ChartContainer config={runsChartConfig} className="min-h-[200px] w-full">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
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
                    width={56}
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
                    dot={{ r: 3 }}
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
              <Skeleton className="h-[180px] w-full" />
            ) : (
              <ChartContainer config={logsChartConfig} className="min-h-[180px] w-full">
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
            <CardTitle className="text-sm font-medium">Erreurs par jour</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : (
              <ChartContainer config={errorsChartConfig} className="min-h-[180px] w-full">
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
            <p className="p-6 text-center text-sm text-muted-foreground">
              Aucun run enregistré pour le moment.
            </p>
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

      {/* Archive icon for empty state hint */}
      {data && data.lastRuns.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
          <Archive className="size-8" />
          <p className="text-sm">Lance ton premier backup pour voir les statistiques ici.</p>
        </div>
      )}
    </div>
  );
}
