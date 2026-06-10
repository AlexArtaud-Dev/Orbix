import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';
import { BackupRunner } from './backup.runner';
import { parseScheduleConfig, type ScheduleConfig } from './backup.types';
import { OrbixException } from '../../common/exceptions';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CronJob } = require('cron') as {
  CronJob: new (
    cronTime: string,
    onTick: () => void,
    onComplete?: null,
    start?: boolean,
    timezone?: string,
  ) => { start(): void };
};

interface RecurringRule {
  days: number[];
  hour: number;
  minute: number;
}

function ruleToExpression(rule: RecurringRule): string {
  const days = rule.days.length === 0 ? '*' : rule.days.join(',');
  return `${rule.minute} ${rule.hour} * * ${days}`;
}

@Injectable()
export class BackupScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly runner: BackupRunner,
    private readonly logs: LogsWriter,
  ) {}

  async onModuleInit() {
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

    for (const backup of backups) {
      const config = parseScheduleConfig(backup.scheduleConfig);
      this.register(
        backup.id,
        backup.name,
        backup.scheduleType,
        backup.schedule,
        config,
      );
    }

    this.logs.info(
      'scheduler',
      'SCHEDULER_INIT',
      'Backup scheduler initialized',
      `${backups.length} job(s) registered`,
    );
  }

  onModuleDestroy() {
    for (const [, timeout] of this.timeouts) clearTimeout(timeout);
    this.timeouts.clear();
  }

  register(
    backupId: string,
    backupName: string,
    scheduleType: string,
    schedule: string | null,
    scheduleConfig: ScheduleConfig,
  ): void {
    this.remove(backupId);

    if (scheduleType === 'manual') return;

    if (scheduleType === 'oneshoot') {
      const cfg = scheduleConfig as { datetime?: string } | null;
      if (!cfg?.datetime) return;

      const delay = new Date(cfg.datetime).getTime() - Date.now();
      if (delay <= 0) {
        void this.prisma.backup.update({
          where: { id: backupId },
          data: { enabled: false },
        });
        this.logs.info(
          'scheduler',
          'SCHEDULER_ONESHOOT_PAST',
          `One-shot already past, disabling: ${backupName}`,
        );
        return;
      }

      const timeout = setTimeout(() => {
        this.timeouts.delete(backupId);
        void this.runner.run(backupId);
      }, delay);

      this.timeouts.set(backupId, timeout);
      this.logs.info(
        'scheduler',
        'SCHEDULER_ONESHOOT_ADDED',
        `One-shot scheduled: ${backupName}`,
        cfg.datetime,
      );
      return;
    }

    if (scheduleType === 'interval') {
      const cfg = scheduleConfig as {
        startDate?: string;
        endDate?: string;
        every?: number;
        unit?: string;
      } | null;

      // End date already passed — disable immediately
      if (cfg?.endDate) {
        const endMs = new Date(cfg.endDate).getTime() - Date.now();
        if (endMs <= 0) {
          void this.prisma.backup.update({
            where: { id: backupId },
            data: { enabled: false },
          });
          this.logs.info(
            'scheduler',
            'SCHEDULER_INTERVAL_EXPIRED',
            `Interval end date past, disabling: ${backupName}`,
          );
          return;
        }
        // Register end-date termination timeout
        const endTimeout = setTimeout(() => {
          this.timeouts.delete(`${backupId}:end`);
          this.remove(backupId);
          void this.prisma.backup.update({
            where: { id: backupId },
            data: { enabled: false },
          });
          this.logs.info(
            'scheduler',
            'SCHEDULER_INTERVAL_END',
            `Interval ended, disabling: ${backupName}`,
          );
        }, endMs);
        this.timeouts.set(`${backupId}:end`, endTimeout);
      }

      // Start date in the future — delay registration
      if (cfg?.startDate) {
        const startMs = new Date(cfg.startDate).getTime() - Date.now();
        if (startMs > 0) {
          const startTimeout = setTimeout(() => {
            this.timeouts.delete(`${backupId}:start`);
            // Re-register without startDate so it runs immediately this time
            const cfgWithoutStart = { ...cfg, startDate: undefined };
            this.register(backupId, backupName, scheduleType, schedule, cfgWithoutStart);
          }, startMs);
          this.timeouts.set(`${backupId}:start`, startTimeout);
          this.logs.info(
            'scheduler',
            'SCHEDULER_INTERVAL_DEFERRED',
            `Interval deferred until startDate: ${backupName}`,
            cfg.startDate,
          );
          return;
        }
      }

      // Register the cron job normally
      if (!schedule) return;
      this.registerCronJob(`backup:${backupId}`, schedule, 'UTC', backupId, backupName);
      return;
    }

    if (scheduleType === 'recurring') {
      const cfg = scheduleConfig as { rules?: RecurringRule[]; timezone?: string } | null;
      const timezone = cfg?.timezone ?? 'UTC';

      // New multi-rule format
      if (cfg?.rules && Array.isArray(cfg.rules) && cfg.rules.length > 0) {
        cfg.rules.forEach((rule, i) => {
          const expression = ruleToExpression(rule);
          this.registerCronJob(
            `backup:${backupId}:rule:${i}`,
            expression,
            timezone,
            backupId,
            backupName,
          );
        });
        return;
      }

      // Legacy: single schedule string
      if (!schedule) return;
      this.registerCronJob(`backup:${backupId}`, schedule, timezone, backupId, backupName);
      return;
    }

    // Fallback for unknown schedule types
    if (!schedule) return;
    const timezone =
      scheduleConfig &&
      typeof scheduleConfig === 'object' &&
      'timezone' in scheduleConfig
        ? String((scheduleConfig as { timezone: string }).timezone)
        : 'UTC';
    this.registerCronJob(`backup:${backupId}`, schedule, timezone, backupId, backupName);
  }

  remove(backupId: string): void {
    // Remove all cron jobs for this backup (single or multi-rule)
    const allJobs = this.schedulerRegistry.getCronJobs();
    for (const [name] of allJobs) {
      if (name === `backup:${backupId}` || name.startsWith(`backup:${backupId}:rule:`)) {
        try {
          this.schedulerRegistry.deleteCronJob(name);
        } catch {
          /* ok */
        }
      }
    }

    // Remove all timeouts (oneshoot, interval start/end)
    for (const key of [backupId, `${backupId}:start`, `${backupId}:end`]) {
      const timeout = this.timeouts.get(key);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(key);
      }
    }
  }

  private registerCronJob(
    jobName: string,
    expression: string,
    timezone: string,
    backupId: string,
    backupName: string,
  ): void {
    try {
      this.schedulerRegistry.deleteCronJob(jobName);
    } catch {
      /* job may not exist yet */
    }

    const job = new CronJob(
      expression,
      () => {
        this.runner.run(backupId).catch((err: unknown) => {
          if (err instanceof OrbixException) {
            this.logs.exception(
              'scheduler',
              err,
              `Cron job failed: ${backupName}`,
              { backupId },
            );
          } else {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            this.logs.error(
              'scheduler',
              'SCHEDULER_JOB_ERROR',
              `Cron job failed: ${backupName}`,
              msg,
              { backupId },
            );
          }
        });
      },
      null,
      false,
      timezone,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.schedulerRegistry.addCronJob(jobName, job as any);
    job.start();

    this.logs.info(
      'scheduler',
      'SCHEDULER_JOB_ADDED',
      `Cron job registered: ${backupName}`,
      `${expression} (${timezone}) [${jobName}]`,
    );
  }
}
