import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';
import { BackupRunner } from './backup.runner';
import { parseScheduleConfig, type ScheduleConfig } from './backup.types';

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

    if (!schedule) return;

    const timezone =
      scheduleConfig &&
      typeof scheduleConfig === 'object' &&
      'timezone' in scheduleConfig
        ? String((scheduleConfig as { timezone: string }).timezone)
        : 'UTC';

    const jobName = `backup:${backupId}`;
    try {
      this.schedulerRegistry.deleteCronJob(jobName);
    } catch {
      /* job may not exist yet */
    }

    const job = new CronJob(
      schedule,
      () => {
        this.runner.run(backupId).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          this.logs.error(
            'scheduler',
            'SCHEDULER_JOB_ERROR',
            `Cron job failed: ${backupName}`,
            msg,
          );
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
      `${schedule} (${timezone})`,
    );
  }

  remove(backupId: string): void {
    try {
      this.schedulerRegistry.deleteCronJob(`backup:${backupId}`);
    } catch {
      /* job may not exist */
    }

    const timeout = this.timeouts.get(backupId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(backupId);
    }
  }
}
