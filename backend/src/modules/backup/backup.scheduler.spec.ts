import { BackupScheduler } from './backup.scheduler';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';
import { SettingsService } from '../settings/settings.service';
import { BackupRunner } from './backup.runner';
import { SchedulerRegistry } from '@nestjs/schedule';

function makeMockPrisma() {
  return {
    backup: { findMany: jest.fn().mockResolvedValue([]) },
    backupRun: { deleteMany: jest.fn() },
  };
}

const mockLogs = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe('BackupScheduler — purgeOldRuns', () => {
  let scheduler: BackupScheduler;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockSettings: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = makeMockPrisma();
    mockSettings = {
      get: jest.fn().mockResolvedValue({ backupRetentionDays: 30 }),
    };

    scheduler = new BackupScheduler(
      null as unknown as SchedulerRegistry,
      mockPrisma as unknown as PrismaService,
      null as unknown as BackupRunner,
      mockLogs as unknown as LogsWriter,
      mockSettings as unknown as SettingsService,
    );
  });

  it('calls deleteMany with startedAt lt the retention cutoff', async () => {
    mockPrisma.backupRun.deleteMany.mockResolvedValue({ count: 0 });

    const before = new Date();
    await scheduler.purgeOldRuns();
    const after = new Date();

    expect(mockPrisma.backupRun.deleteMany).toHaveBeenCalledTimes(1);

    type DeleteArg = { where: { startedAt: { lt: Date } } };
    const calls30 = mockPrisma.backupRun.deleteMany.mock.calls as Array<
      [DeleteArg]
    >;
    const { where } = calls30[0][0];

    const cutoff = where.startedAt.lt;
    expect(cutoff).toBeInstanceOf(Date);

    // cutoff should be approximately (now - 30 days)
    const expectedMin = new Date(before.getTime() - 30 * 24 * 60 * 60 * 1000);
    const expectedMax = new Date(after.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
  });

  it('uses backupRetentionDays from settings', async () => {
    mockSettings.get.mockResolvedValue({ backupRetentionDays: 7 });
    mockPrisma.backupRun.deleteMany.mockResolvedValue({ count: 0 });

    const before = new Date();
    await scheduler.purgeOldRuns();
    const after = new Date();

    type DeleteArg = { where: { startedAt: { lt: Date } } };
    const calls7 = mockPrisma.backupRun.deleteMany.mock.calls as Array<
      [DeleteArg]
    >;
    const { where } = calls7[0][0];
    const cutoff = where.startedAt.lt;

    const expectedMin = new Date(before.getTime() - 7 * 24 * 60 * 60 * 1000);
    const expectedMax = new Date(after.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
  });

  it('logs info when at least one run is purged', async () => {
    mockPrisma.backupRun.deleteMany.mockResolvedValue({ count: 3 });

    await scheduler.purgeOldRuns();

    expect(mockLogs.info).toHaveBeenCalledWith(
      'scheduler',
      'BACKUP_RUN_PURGE',
      expect.stringContaining('3'),
      expect.stringContaining('30'),
    );
  });

  it('does not log when no runs are purged', async () => {
    mockPrisma.backupRun.deleteMany.mockResolvedValue({ count: 0 });

    await scheduler.purgeOldRuns();

    expect(mockLogs.info).not.toHaveBeenCalled();
  });
});
