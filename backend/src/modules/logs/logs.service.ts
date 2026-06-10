import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { ListLogsQuery } from './logs.types';
import type { LogEntry } from './logs.writer';

@Injectable()
export class LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async list(
    query: ListLogsQuery,
  ): Promise<{ data: LogEntry[]; nextCursor: string | null }> {
    const limit = Math.min(query.limit ?? 50, 200);

    const where: Record<string, unknown> = {};
    if (query.category) {
      const cats = Array.isArray(query.category)
        ? query.category
        : [query.category];
      where['category'] = cats.length === 1 ? cats[0] : { in: cats };
    }
    if (query.level) {
      const lvls = Array.isArray(query.level) ? query.level : [query.level];
      where['level'] = lvls.length === 1 ? lvls[0] : { in: lvls };
    }
    if (query.backupId) where['backupId'] = query.backupId;
    if (query.from || query.to) {
      where['ts'] = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.cursor) {
      where['id'] = { lt: query.cursor };
    }

    const rows = await this.prisma.log.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: limit + 1,
    });

    const hasNext = rows.length > limit;
    const page = rows.slice(0, limit);

    return {
      data: page.map((r) => ({
        ts: r.ts.toISOString(),
        level: r.level as LogEntry['level'],
        category: r.category as LogEntry['category'],
        code: r.code,
        msg: r.msg,
        detail: r.detail ?? undefined,
        backupId: r.backupId ?? undefined,
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  /** Return distinct categories present in the logs table */
  async getCategories(): Promise<string[]> {
    const rows = await this.prisma.log.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }

  /** Count ERROR logs per backup — for sidebar badge */
  async getBackupErrorSummary(): Promise<{
    totalErrors: number;
    affectedBackups: number;
  }> {
    const result = await this.prisma.log.groupBy({
      by: ['backupId'],
      where: { level: 'ERROR', category: 'backup', backupId: { not: null } },
      _count: { id: true },
    });
    return {
      totalErrors: result.reduce((sum, r) => sum + r._count.id, 0),
      affectedBackups: result.length,
    };
  }

  /** Count ERROR logs for a specific backup */
  async getBackupErrorCount(backupId: string): Promise<number> {
    return this.prisma.log.count({
      where: { backupId, level: 'ERROR', category: 'backup' },
    });
  }

  /** List recent logs for a specific backup */
  async listBackupLogs(backupId: string, limit = 50): Promise<LogEntry[]> {
    const rows = await this.prisma.log.findMany({
      where: { backupId },
      orderBy: { ts: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      ts: r.ts.toISOString(),
      level: r.level as LogEntry['level'],
      category: r.category as LogEntry['category'],
      code: r.code,
      msg: r.msg,
      detail: r.detail ?? undefined,
      backupId: r.backupId ?? undefined,
    }));
  }

  /** Clear all logs for a specific backup */
  async clearBackupLogs(backupId: string): Promise<void> {
    await this.prisma.log.deleteMany({ where: { backupId } });
  }

  // ─── Auto-cleanup cron ─────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanOldLogs(): Promise<void> {
    try {
      const s = await this.settings.get();
      const retentionHours =
        (s as { logRetentionHours?: number }).logRetentionHours ?? 720;
      const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
      const { count } = await this.prisma.log.deleteMany({
        where: { ts: { lt: cutoff } },
      });
      if (count > 0) {
        // Write directly to avoid circular dependency
        await this.prisma.log.create({
          data: {
            level: 'INFO',
            category: 'system',
            code: 'LOG_CLEANUP',
            msg: `Cleaned ${count} log(s) older than ${retentionHours}h`,
          },
        });
      }
    } catch {
      // Swallow — cleanup failure is not critical
    }
  }
}
