import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

type Period = '7d' | '30d' | '365d';

function periodToDays(period: Period): number {
  if (period === '7d') return 7;
  if (period === '365d') return 365;
  return 30;
}

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Use UTC midnight to stay consistent with toISOString() (also UTC)
function fillRunDays(
  from: Date,
  to: Date,
): Record<string, { success: number; error: number }> {
  const map: Record<string, { success: number; error: number }> = {};
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(23, 59, 59, 999);
  while (d <= end) {
    map[toYMD(d)] = { success: 0, error: 0 };
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return map;
}

function fillLogDays(
  from: Date,
  to: Date,
): Record<
  string,
  { debug: number; info: number; warn: number; error: number }
> {
  const map: Record<
    string,
    { debug: number; info: number; warn: number; error: number }
  > = {};
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(23, 59, 59, 999);
  while (d <= end) {
    map[toYMD(d)] = { debug: 0, info: 0, warn: 0, error: 0 };
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return map;
}

function ruleToExpression(rule: {
  days: number[];
  hour: number;
  minute: number;
}): string {
  const days = rule.days.length === 0 ? '*' : rule.days.join(',');
  return `${rule.minute} ${rule.hour} * * ${days}`;
}

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async get(period: Period = '30d') {
    const days = periodToDays(period);
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);

    const [
      backupsActive,
      backupsTotal,
      inputs,
      vaultHttp,
      vaultEmail,
      contacts,
      recentRunsRaw,
      lastRunsRaw,
      logsRaw,
      nextScheduled,
    ] = await Promise.all([
      this.prisma.backup.count({ where: { enabled: true } }),
      this.prisma.backup.count(),
      this.prisma.input.count(),
      this.prisma.vaultEntity.count({ where: { type: 'http' } }),
      this.prisma.vaultEntity.count({ where: { type: 'email' } }),
      this.prisma.contact.count(),
      this.prisma.backupRun.findMany({
        where: {
          startedAt: { gte: from },
          status: { in: ['success', 'error'] },
        },
        select: {
          startedAt: true,
          finishedAt: true,
          status: true,
          archiveSizeBytes: true,
        },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.backupRun.findMany({
        where: { status: { not: 'running' } },
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          startedAt: true,
          finishedAt: true,
          status: true,
          archiveSizeBytes: true,
          triggerType: true,
          backup: { select: { name: true } },
        },
      }),
      this.prisma.log.findMany({
        where: { ts: { gte: from } },
        select: { ts: true, level: true },
        orderBy: { ts: 'asc' },
      }),
      this.computeNextScheduled(),
    ]);

    const runsByDay = fillRunDays(from, now);
    for (const r of recentRunsRaw) {
      const day = toYMD(r.startedAt);
      const entry = runsByDay[day];
      if (!entry) continue;
      if (r.status === 'success') entry.success++;
      else entry.error++;
    }

    const logsByLevelDay = fillLogDays(from, now);
    for (const l of logsRaw) {
      const day = toYMD(l.ts);
      const entry = logsByLevelDay[day];
      if (!entry) continue;
      const level = l.level.toLowerCase() as
        | 'debug'
        | 'info'
        | 'warn'
        | 'error';
      if (level in entry) entry[level]++;
    }

    // Period aggregates
    const totalRuns = recentRunsRaw.length;
    const successRuns = recentRunsRaw.filter(
      (r) => r.status === 'success',
    ).length;
    const successRate =
      totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;

    const runsWithSize = recentRunsRaw.filter(
      (r) => r.archiveSizeBytes !== null,
    );
    const avgSizeBytes =
      runsWithSize.length > 0
        ? Math.round(
            runsWithSize.reduce((s, r) => s + (r.archiveSizeBytes ?? 0), 0) /
              runsWithSize.length,
          )
        : null;

    const runsWithDuration = recentRunsRaw.filter((r) => r.finishedAt !== null);
    const avgDurationMs =
      runsWithDuration.length > 0
        ? Math.round(
            runsWithDuration.reduce(
              (s, r) => s + (r.finishedAt!.getTime() - r.startedAt.getTime()),
              0,
            ) / runsWithDuration.length,
          )
        : null;

    return {
      counts: {
        backupsActive,
        backupsTotal,
        inputs,
        vaultHttp,
        vaultEmail,
        contacts,
      },
      periodStats: { totalRuns, successRate, avgSizeBytes, avgDurationMs },
      recentRuns: Object.entries(runsByDay).map(([date, v]) => ({
        date,
        ...v,
      })),
      lastRuns: lastRunsRaw.map((r) => ({
        id: r.id,
        backupName: r.backup.name,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        status: r.status,
        archiveSizeBytes: r.archiveSizeBytes,
        durationMs:
          r.finishedAt != null
            ? r.finishedAt.getTime() - r.startedAt.getTime()
            : null,
        triggerType: r.triggerType,
      })),
      nextScheduled,
      logsByLevel: Object.entries(logsByLevelDay).map(([date, v]) => ({
        date,
        ...v,
      })),
      errorsByDay: Object.entries(logsByLevelDay).map(([date, v]) => ({
        date,
        count: v.error,
      })),
    };
  }

  private async computeNextScheduled(): Promise<{
    backupId: string;
    backupName: string;
    nextRunAt: string;
  } | null> {
    const backups = await this.prisma.backup.findMany({
      where: { enabled: true, scheduleType: { not: 'manual' } },
      select: {
        id: true,
        name: true,
        scheduleType: true,
        schedule: true,
        scheduleConfig: true,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { CronJob } = require('cron');

    let earliest: {
      backupId: string;
      backupName: string;
      nextRunAt: Date;
    } | null = null;

    const updateEarliest = (id: string, name: string, dt: Date) => {
      if (dt > new Date() && (!earliest || dt < earliest.nextRunAt)) {
        earliest = { backupId: id, backupName: name, nextRunAt: dt };
      }
    };

    for (const b of backups) {
      const config = b.scheduleConfig as Record<string, unknown> | null;

      if (
        b.scheduleType === 'oneshoot' &&
        typeof config?.datetime === 'string'
      ) {
        updateEarliest(b.id, b.name, new Date(config.datetime));
        continue;
      }

      const expressions: string[] = [];

      if (
        b.scheduleType === 'recurring' &&
        config?.rules &&
        Array.isArray(config.rules)
      ) {
        const rules = config.rules as Array<{
          days: number[];
          hour: number;
          minute: number;
        }>;
        expressions.push(...rules.map(ruleToExpression));
      } else if (b.schedule) {
        expressions.push(b.schedule);
      }

      for (const expr of expressions) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const job = new CronJob(expr, () => {}, null, false, 'UTC') as {
            nextDate(): { toJSDate(): Date } | null;
          };
          const next = job.nextDate();
          if (next) updateEarliest(b.id, b.name, next.toJSDate());
        } catch {
          // invalid expression
        }
      }
    }

    if (!earliest) return null;
    const e = earliest as {
      backupId: string;
      backupName: string;
      nextRunAt: Date;
    };
    return {
      backupId: e.backupId,
      backupName: e.backupName,
      nextRunAt: e.nextRunAt.toISOString(),
    };
  }
}
