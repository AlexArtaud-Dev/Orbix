import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

type RunRow = {
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  archiveSizeBytes: number | null;
};

function makeMockPrisma() {
  return {
    backup: {
      count: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    input: { count: jest.fn().mockResolvedValue(0) },
    vaultEntity: { count: jest.fn().mockResolvedValue(0) },
    contact: { count: jest.fn().mockResolvedValue(0) },
    backupRun: { findMany: jest.fn().mockResolvedValue([]) },
    log: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function makeMockSettings() {
  return { get: jest.fn().mockResolvedValue({ backupRetentionDays: 30 }) };
}

describe('StatsService', () => {
  let service: StatsService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockPrisma.backup.count
      .mockResolvedValueOnce(2) // enabled: true  →  backupsActive
      .mockResolvedValueOnce(3); // all             →  backupsTotal
    mockPrisma.input.count.mockResolvedValue(1);
    mockPrisma.vaultEntity.count
      .mockResolvedValueOnce(2) // type: http
      .mockResolvedValueOnce(1); // type: email
    mockPrisma.contact.count.mockResolvedValue(5);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SettingsService, useValue: makeMockSettings() },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  // ─── counts ───────────────────────────────────────────────────────────────────

  describe('counts', () => {
    it('returns active and total backup counts', async () => {
      const result = await service.get('30d');
      expect(result.counts.backupsActive).toBe(2);
      expect(result.counts.backupsTotal).toBe(3);
    });

    it('returns input, vault, and contact counts', async () => {
      const result = await service.get('30d');
      expect(result.counts.inputs).toBe(1);
      expect(result.counts.vaultHttp).toBe(2);
      expect(result.counts.vaultEmail).toBe(1);
      expect(result.counts.contacts).toBe(5);
    });
  });

  // ─── periodStats ─────────────────────────────────────────────────────────────

  describe('periodStats', () => {
    it('returns zero stats when no runs in period', async () => {
      const result = await service.get('30d');
      expect(result.periodStats.totalRuns).toBe(0);
      expect(result.periodStats.successRate).toBe(0);
      expect(result.periodStats.avgSizeBytes).toBeNull();
      expect(result.periodStats.avgDurationMs).toBeNull();
    });

    it('counts total runs', async () => {
      const runs: RunRow[] = [
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'success',
          archiveSizeBytes: null,
        },
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'error',
          archiveSizeBytes: null,
        },
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'success',
          archiveSizeBytes: null,
        },
      ];
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce(runs) // recentRunsRaw
        .mockResolvedValueOnce([]); // lastRunsRaw

      const result = await service.get('30d');
      expect(result.periodStats.totalRuns).toBe(3);
    });

    it('computes 50% success rate', async () => {
      const runs: RunRow[] = [
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'success',
          archiveSizeBytes: null,
        },
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'success',
          archiveSizeBytes: null,
        },
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'error',
          archiveSizeBytes: null,
        },
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'error',
          archiveSizeBytes: null,
        },
      ];
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce(runs)
        .mockResolvedValueOnce([]);

      const result = await service.get('30d');
      expect(result.periodStats.successRate).toBe(50);
    });

    it('computes 100% success rate when all runs succeed', async () => {
      const runs: RunRow[] = [
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'success',
          archiveSizeBytes: 1000,
        },
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'success',
          archiveSizeBytes: 2000,
        },
      ];
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce(runs)
        .mockResolvedValueOnce([]);

      const result = await service.get('30d');
      expect(result.periodStats.successRate).toBe(100);
    });

    it('computes average size only from non-null archiveSizeBytes', async () => {
      const runs: RunRow[] = [
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'success',
          archiveSizeBytes: 1000,
        },
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'error',
          archiveSizeBytes: null,
        },
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'success',
          archiveSizeBytes: 3000,
        },
      ];
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce(runs)
        .mockResolvedValueOnce([]);

      const result = await service.get('30d');
      expect(result.periodStats.avgSizeBytes).toBe(2000);
    });

    it('returns null avgSizeBytes when all archiveSizeBytes are null', async () => {
      const runs: RunRow[] = [
        {
          startedAt: new Date(),
          finishedAt: new Date(),
          status: 'error',
          archiveSizeBytes: null,
        },
      ];
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce(runs)
        .mockResolvedValueOnce([]);

      const result = await service.get('30d');
      expect(result.periodStats.avgSizeBytes).toBeNull();
    });

    it('computes average duration from runs that have finishedAt', async () => {
      const base = new Date('2026-06-12T10:00:00Z');
      const runs: RunRow[] = [
        {
          startedAt: base,
          finishedAt: new Date('2026-06-12T10:00:05Z'),
          status: 'success',
          archiveSizeBytes: null,
        }, // 5000ms
        {
          startedAt: base,
          finishedAt: null,
          status: 'error',
          archiveSizeBytes: null,
        }, // excluded
        {
          startedAt: base,
          finishedAt: new Date('2026-06-12T10:00:15Z'),
          status: 'success',
          archiveSizeBytes: null,
        }, // 15000ms
      ];
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce(runs)
        .mockResolvedValueOnce([]);

      const result = await service.get('30d');
      expect(result.periodStats.avgDurationMs).toBe(10000); // (5000 + 15000) / 2
    });

    it('returns null avgDurationMs when all runs have null finishedAt', async () => {
      const runs: RunRow[] = [
        {
          startedAt: new Date(),
          finishedAt: null,
          status: 'error',
          archiveSizeBytes: null,
        },
      ];
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce(runs)
        .mockResolvedValueOnce([]);

      const result = await service.get('30d');
      expect(result.periodStats.avgDurationMs).toBeNull();
    });
  });

  // ─── recentRuns — UTC date bucketing ─────────────────────────────────────────

  describe('recentRuns (UTC bucketing)', () => {
    it('places a success run at 10:00 UTC into the correct date bucket', async () => {
      const runs: RunRow[] = [
        {
          startedAt: new Date('2026-06-12T10:00:00Z'),
          finishedAt: new Date('2026-06-12T10:00:05Z'),
          status: 'success',
          archiveSizeBytes: null,
        },
      ];
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce(runs)
        .mockResolvedValueOnce([]);

      const result = await service.get('7d');
      const entry = result.recentRuns.find((r) => r.date === '2026-06-12');
      expect(entry).toBeDefined();
      expect(entry?.success).toBe(1);
      expect(entry?.error).toBe(0);
    });

    it('places an error run in the error bucket of the correct date', async () => {
      const runs: RunRow[] = [
        {
          startedAt: new Date('2026-06-12T08:30:00Z'),
          finishedAt: new Date('2026-06-12T08:30:01Z'),
          status: 'error',
          archiveSizeBytes: null,
        },
      ];
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce(runs)
        .mockResolvedValueOnce([]);

      const result = await service.get('7d');
      const entry = result.recentRuns.find((r) => r.date === '2026-06-12');
      expect(entry?.error).toBe(1);
      expect(entry?.success).toBe(0);
    });

    it('returns 8 daily entries for the 7d period (day-7 to today inclusive)', async () => {
      const result = await service.get('7d');
      expect(result.recentRuns).toHaveLength(8);
    });

    it('returns 31 daily entries for the 30d period', async () => {
      const result = await service.get('30d');
      expect(result.recentRuns).toHaveLength(31);
    });

    it('returns 366 daily entries for the 365d period', async () => {
      const result = await service.get('365d');
      expect(result.recentRuns).toHaveLength(366);
    });

    it('all recentRuns entries are initialised to zero when no runs exist', async () => {
      const result = await service.get('7d');
      const nonZero = result.recentRuns.filter(
        (r) => r.success !== 0 || r.error !== 0,
      );
      expect(nonZero).toHaveLength(0);
    });
  });

  // ─── lastRuns mapping ────────────────────────────────────────────────────────

  describe('lastRuns', () => {
    it('computes durationMs from startedAt and finishedAt', async () => {
      const startedAt = new Date('2026-06-12T10:00:00Z');
      const finishedAt = new Date('2026-06-12T10:00:07Z'); // 7000ms

      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce([]) // recentRunsRaw
        .mockResolvedValueOnce([
          {
            id: 'run-1',
            startedAt,
            finishedAt,
            status: 'success',
            archiveSizeBytes: 1500,
            triggerType: 'manual',
            backup: { name: 'My Backup' },
          },
        ]);

      const result = await service.get('30d');
      expect(result.lastRuns).toHaveLength(1);
      expect(result.lastRuns[0].backupName).toBe('My Backup');
      expect(result.lastRuns[0].durationMs).toBe(7000);
      expect(result.lastRuns[0].triggerType).toBe('manual');
    });

    it('sets durationMs to null when finishedAt is null', async () => {
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'run-2',
            startedAt: new Date(),
            finishedAt: null,
            status: 'running',
            archiveSizeBytes: null,
            triggerType: 'scheduler',
            backup: { name: 'Backup B' },
          },
        ]);

      const result = await service.get('30d');
      expect(result.lastRuns[0].durationMs).toBeNull();
    });

    it('exposes ISO strings for startedAt and finishedAt', async () => {
      const startedAt = new Date('2026-06-12T10:00:00Z');
      const finishedAt = new Date('2026-06-12T10:00:05Z');
      mockPrisma.backupRun.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'run-3',
            startedAt,
            finishedAt,
            status: 'success',
            archiveSizeBytes: null,
            triggerType: 'api',
            backup: { name: 'C' },
          },
        ]);

      const result = await service.get('30d');
      expect(result.lastRuns[0].startedAt).toBe(startedAt.toISOString());
      expect(result.lastRuns[0].finishedAt).toBe(finishedAt.toISOString());
    });
  });
});
