import { Injectable, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';
import { BackupRunner } from './backup.runner';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CronJob } = require('cron') as {
  CronJob: new (
    cronTime: string,
    onTick: () => void,
  ) => { start(): void };
};

@Injectable()
export class BackupScheduler implements OnModuleInit {
  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly runner: BackupRunner,
    private readonly logs: LogsWriter,
  ) {}

  async onModuleInit() {
    const backups = await this.prisma.backup.findMany({
      where: { enabled: true, schedule: { not: null } },
      select: { id: true, name: true, schedule: true },
    });

    for (const backup of backups) {
      if (backup.schedule) {
        this.register(backup.id, backup.name, backup.schedule);
      }
    }

    this.logs.info(
      'scheduler',
      'SCHEDULER_INIT',
      'Backup scheduler initialized',
      `${backups.length} job(s) registered`,
    );
  }

  register(backupId: string, backupName: string, cronExpression: string): void {
    const jobName = `backup:${backupId}`;

    try {
      this.schedulerRegistry.deleteCronJob(jobName);
    } catch {}

    const job = new CronJob(cronExpression, () => {
      this.runner.run(backupId).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logs.error(
          'scheduler',
          'SCHEDULER_JOB_ERROR',
          `Cron job failed for backup: ${backupName}`,
          msg,
        );
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    this.schedulerRegistry.addCronJob(jobName, job as any);
    job.start();

    this.logs.info(
      'scheduler',
      'SCHEDULER_JOB_ADDED',
      `Cron job registered: ${backupName}`,
      cronExpression,
    );
  }

  remove(backupId: string): void {
    try {
      this.schedulerRegistry.deleteCronJob(`backup:${backupId}`);
      this.logs.info(
        'scheduler',
        'SCHEDULER_JOB_REMOVED',
        `Cron job removed for backup: ${backupId}`,
      );
    } catch {}
  }
}
