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

/** Exposes private runner methods for unit testing */
type RunnerPrivate = {
  parseContentDispositionFilename(header: string | null): string | null;
  resolveZipPassword(
    literal: string | null,
    vaultRef: string | null,
  ): Promise<string | null>;
};

describe('BackupRunner', () => {
  let runner: BackupRunner;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockVault: { getVariableSetPayloadBySlug: jest.Mock };

  beforeEach(async () => {
    // Reset static format registration flags before each test
    (BackupRunner as unknown as Record<string, boolean>)[
      'encryptedFormatRegistered'
    ] = false;
    (BackupRunner as unknown as Record<string, boolean>)[
      'bzip2FormatRegistered'
    ] = false;

    mockPrisma = makeMockPrisma();
    mockVault = { getVariableSetPayloadBySlug: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupRunner,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VaultService, useValue: mockVault },
        {
          provide: SettingsService,
          useValue: { get: jest.fn().mockResolvedValue({ filesRoot: '/tmp' }) },
        },
        {
          provide: InputService,
          useValue: { getOne: jest.fn(), list: jest.fn() },
        },
        { provide: LogsWriter, useValue: mockLogs },
      ],
    }).compile();

    runner = module.get<BackupRunner>(BackupRunner);
  });

  function priv(): RunnerPrivate {
    return runner as unknown as RunnerPrivate;
  }

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

  // ─── parseContentDispositionFilename ─────────────────────────────────────────

  describe('parseContentDispositionFilename', () => {
    it('returns null for a null header', () => {
      expect(priv().parseContentDispositionFilename(null)).toBeNull();
    });

    it('returns null when the header contains no filename directive', () => {
      expect(priv().parseContentDispositionFilename('inline')).toBeNull();
      expect(
        priv().parseContentDispositionFilename('attachment'),
      ).toBeNull();
    });

    it('extracts filename from double-quoted value', () => {
      expect(
        priv().parseContentDispositionFilename(
          'attachment; filename="portainer_backup.tar.gz"',
        ),
      ).toBe('portainer_backup.tar.gz');
    });

    it('extracts filename from single-quoted value', () => {
      expect(
        priv().parseContentDispositionFilename(
          "attachment; filename='my-backup.zip'",
        ),
      ).toBe('my-backup.zip');
    });

    it('extracts filename from unquoted value', () => {
      expect(
        priv().parseContentDispositionFilename(
          'attachment; filename=backup.json',
        ),
      ).toBe('backup.json');
    });

    it('URL-decodes RFC 5987 encoded filename', () => {
      expect(
        priv().parseContentDispositionFilename(
          "attachment; filename*=UTF-8''my%20backup.tar.gz",
        ),
      ).toBe('my backup.tar.gz');
    });

    it('falls back gracefully when URL decoding fails (returns raw name)', () => {
      // Malformed percent-encoding — should still return something rather than throw
      const result = priv().parseContentDispositionFilename(
        'attachment; filename=backup%GG.tar.gz',
      );
      expect(result).not.toBeNull();
    });
  });

  // ─── resolveZipPassword ──────────────────────────────────────────────────────

  describe('resolveZipPassword', () => {
    it('returns the literal password when vaultRef is null', async () => {
      await expect(
        priv().resolveZipPassword('my-secret', null),
      ).resolves.toBe('my-secret');
    });

    it('returns null when both literal and vaultRef are null', async () => {
      await expect(
        priv().resolveZipPassword(null, null),
      ).resolves.toBeNull();
    });

    it('returns the literal when vaultRef is an empty string (treated as falsy)', async () => {
      await expect(
        priv().resolveZipPassword('fallback', ''),
      ).resolves.toBe('fallback');
    });

    it('resolves the vault variable when vaultRef is "slug.key"', async () => {
      mockVault.getVariableSetPayloadBySlug.mockResolvedValue({
        mykey: 'vault-secret',
      });

      await expect(
        priv().resolveZipPassword(null, 'myslug.mykey'),
      ).resolves.toBe('vault-secret');

      expect(mockVault.getVariableSetPayloadBySlug).toHaveBeenCalledWith(
        'myslug',
      );
    });

    it('falls back to the literal when vaultRef has no dot separator (invalid format)', async () => {
      // resolveZipPassword returns literal as fallback when format is invalid
      await expect(
        priv().resolveZipPassword('fallback', 'nodot'),
      ).resolves.toBe('fallback');
    });

    it('returns null when vault resolution throws (graceful failure)', async () => {
      mockVault.getVariableSetPayloadBySlug.mockRejectedValue(
        new Error('vault not found'),
      );

      await expect(
        priv().resolveZipPassword('fallback', 'slug.key'),
      ).resolves.toBeNull();
    });

    it('returns null when vault key is not found in the variable set payload', async () => {
      mockVault.getVariableSetPayloadBySlug.mockResolvedValue({
        otherkey: 'something',
      });

      await expect(
        priv().resolveZipPassword(null, 'slug.missingkey'),
      ).resolves.toBeNull();
    });
  });
});
