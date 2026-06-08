import { Test, TestingModule } from '@nestjs/testing';
import { BackupRunner } from './backup.runner';
import { PrismaService } from '../../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import { SettingsService } from '../settings/settings.service';
import { LogsWriter } from '../logs/logs.writer';
import { InputService } from '../input/input.service';

const mockLogs = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function makeMockPrisma() {
  return {
    backup: { findUnique: jest.fn(), update: jest.fn() },
    backupOutput: { deleteMany: jest.fn() },
  };
}

describe('BackupRunner', () => {
  let runner: BackupRunner;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    // Reset static format registration flags before each test
    (BackupRunner as unknown as Record<string, boolean>)[
      'encryptedFormatRegistered'
    ] = false;
    (BackupRunner as unknown as Record<string, boolean>)[
      'bzip2FormatRegistered'
    ] = false;

    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupRunner,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VaultService, useValue: {} },
        {
          provide: SettingsService,
          useValue: { get: jest.fn().mockResolvedValue({ filesRoot: '/tmp' }) },
        },
        { provide: InputService, useValue: { getOne: jest.fn(), list: jest.fn() } },
        { provide: LogsWriter, useValue: mockLogs },
      ],
    }).compile();

    runner = module.get<BackupRunner>(BackupRunner);
  });

  describe('static format registration guards', () => {
    it('encryptedFormatRegistered initialises to false', () => {
      expect(
        (BackupRunner as unknown as Record<string, boolean>)[
          'encryptedFormatRegistered'
        ],
      ).toBe(false);
    });

    it('bzip2FormatRegistered initialises to false', () => {
      expect(
        (BackupRunner as unknown as Record<string, boolean>)[
          'bzip2FormatRegistered'
        ],
      ).toBe(false);
    });

    it('sets encryptedFormatRegistered to true after first encrypted zip creation', async () => {
      // Only callable when archiver-zip-encrypted is available; skip gracefully if not installed
      const isAvailable = (runner as unknown as Record<string, () => boolean>)[
        'isEncryptedAvailable'
      ]();
      if (!isAvailable) return;

      await (
        runner as unknown as Record<
          string,
          (...args: unknown[]) => Promise<unknown>
        >
      )['createEncryptedZip']([], 6, 'test-password');

      expect(
        (BackupRunner as unknown as Record<string, boolean>)[
          'encryptedFormatRegistered'
        ],
      ).toBe(true);
    });

    it('does not call registerFormat twice on repeated encrypted zip calls', async () => {
      const isAvailable = (runner as unknown as Record<string, () => boolean>)[
        'isEncryptedAvailable'
      ]();
      if (!isAvailable) return;

      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
      const archiverModule = require('archiver');
      const registerSpy = jest
        .spyOn(archiverModule, 'registerFormat')
        .mockImplementation(() => undefined);

      const createEncryptedZip = (
        runner as unknown as Record<
          string,
          (...args: unknown[]) => Promise<unknown>
        >
      )['createEncryptedZip'].bind(runner);

      await createEncryptedZip([], 6, 'pw1').catch(() => undefined);
      await createEncryptedZip([], 6, 'pw2').catch(() => undefined);

      // registerFormat must be called at most once
      expect(
        registerSpy.mock.calls.filter((c) => c[0] === 'zip-encrypted').length,
      ).toBeLessThanOrEqual(1);

      registerSpy.mockRestore();
    });
  });

  describe('getZipInfo', () => {
    it('returns platform and node version', () => {
      const info = runner.getZipInfo();
      expect(info.platform).toBe(process.platform);
      expect(info.node).toBe(process.version);
    });

    it('returns basic as true (archiver is always available)', () => {
      const info = runner.getZipInfo();
      expect(info.basic).toBe(true);
    });

    it('reflects archiver-zip-encrypted availability', () => {
      const isAvailable = (runner as unknown as Record<string, () => boolean>)[
        'isEncryptedAvailable'
      ]();
      const info = runner.getZipInfo();
      expect(info.encrypted).toBe(isAvailable);
    });

    it('reflects archiver-tar-bzip2 availability', () => {
      const isAvailable = (runner as unknown as Record<string, () => boolean>)[
        'isBzip2Available'
      ]();
      const info = runner.getZipInfo();
      expect(info.tarBz2).toBe(isAvailable);
    });
  });

  describe('run', () => {
    it('logs an error and returns when backup is not found', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue(null);

      await runner.run('unknown-id');

      expect(mockLogs.error).toHaveBeenCalledWith(
        'backup',
        'BACKUP_RUN_NOT_FOUND',
        expect.stringContaining('unknown-id'),
        undefined,
        expect.anything(),
      );
    });
  });

  describe('runValidation', () => {
    it('logs an error and returns when backup is not found', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue(null);

      await runner.runValidation('unknown-id');

      expect(mockLogs.error).toHaveBeenCalledWith(
        'backup',
        'BACKUP_VALIDATE_NOT_FOUND',
        expect.stringContaining('unknown-id'),
        undefined,
        expect.anything(),
      );
    });
  });
});
