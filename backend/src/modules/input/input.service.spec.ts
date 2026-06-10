import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InputService } from './input.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import { LogsWriter } from '../logs/logs.writer';
import * as inputHttpUtil from './input-http.util';

jest.mock('./input-http.util', () => ({
  fetchWithConfig: jest.fn(),
}));

const mockFetch = inputHttpUtil.fetchWithConfig as jest.MockedFunction<typeof inputHttpUtil.fetchWithConfig>;

const mockLogs = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  exception: jest.fn(),
};

const NOW = new Date('2026-01-01T00:00:00.000Z');

function makeInputRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'input-1',
    name: 'My Input',
    type: 'http_rest',
    vaultId: null,
    config: { baseUrl: 'https://api.example.com/backup', method: 'GET' },
    requestParams: [],
    enabled: true,
    lastTestStatus: null,
    lastTestError: null,
    lastTestAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeMockPrisma() {
  return {
    input: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

/** Exposes private methods for testing without TypeScript complaints */
type ServicePrivate = {
  extractExt(filename: string): string;
  detectFileExtension(
    contentDisposition: string | null,
    contentType: string | null,
    fallbackUrl?: string,
  ): string;
};

describe('InputService', () => {
  let service: InputService;
  let prisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    prisma = makeMockPrisma();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InputService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: VaultService,
          useValue: {
            getHttpPayload: jest.fn().mockRejectedValue(new Error('not found')),
            getVariableSetPayloadBySlug: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: LogsWriter, useValue: mockLogs },
      ],
    }).compile();

    service = module.get<InputService>(InputService);
  });

  function priv(): ServicePrivate {
    return service as unknown as ServicePrivate;
  }

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and returns the new input', async () => {
      const row = makeInputRow();
      prisma.input.create.mockResolvedValue(row);

      const result = await service.create({
        name: 'My Input',
        type: 'http_rest',
        config: { baseUrl: 'https://api.example.com/backup', method: 'GET' },
      });

      expect(prisma.input.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(row);
    });

    it('throws ConflictException on duplicate name (Prisma P2002)', async () => {
      prisma.input.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create({ name: 'Duplicate', type: 'http_rest', config: {} }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── list ────────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns items with no nextCursor when below limit', async () => {
      const rows = [makeInputRow({ id: 'a' }), makeInputRow({ id: 'b' })];
      prisma.input.findMany.mockResolvedValue(rows);

      const result = await service.list(undefined, 10);

      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when there are more items than limit', async () => {
      const rows = Array.from({ length: 6 }, (_, i) => makeInputRow({ id: `id-${i}` }));
      prisma.input.findMany.mockResolvedValue(rows);

      const result = await service.list(undefined, 5);

      expect(result.data).toHaveLength(5);
      expect(result.nextCursor).toBe('id-4');
    });
  });

  // ─── getOne ──────────────────────────────────────────────────────────────────

  describe('getOne', () => {
    it('returns the input when found', async () => {
      const row = makeInputRow();
      prisma.input.findUnique.mockResolvedValue(row);

      const result = await service.getOne('input-1');

      expect(result).toEqual(row);
    });

    it('throws NotFoundException when not found', async () => {
      prisma.input.findUnique.mockResolvedValue(null);

      await expect(service.getOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes and logs the deletion', async () => {
      const row = makeInputRow();
      prisma.input.findUnique.mockResolvedValue(row);
      prisma.input.delete.mockResolvedValue(row);

      await service.delete('input-1');

      expect(prisma.input.delete).toHaveBeenCalledWith({ where: { id: 'input-1' } });
      expect(mockLogs.info).toHaveBeenCalledWith(
        'system',
        'INPUT_DELETED',
        expect.stringContaining('My Input'),
        undefined,
      );
    });

    it('throws NotFoundException when input does not exist', async () => {
      prisma.input.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── test() ──────────────────────────────────────────────────────────────────

  describe('test()', () => {
    it('throws NotFoundException when input does not exist', async () => {
      prisma.input.findUnique.mockResolvedValue(null);

      await expect(service.test('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns success:true + count for a 2xx JSON-array response', async () => {
      const row = makeInputRow({
        config: { baseUrl: 'https://api.example.com', listEndpoint: '/items', method: 'GET' },
      });
      prisma.input.findUnique.mockResolvedValue(row);
      prisma.input.update.mockResolvedValue(row);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify([{ id: 1 }, { id: 2 }])),
        headers: { get: jest.fn().mockReturnValue(null) },
      } as unknown as Response);

      const result = await service.test('input-1');

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(prisma.input.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastTestStatus: 'ok' }),
        }),
      );
    });

    it('returns success:false + error string on non-ok HTTP response', async () => {
      const row = makeInputRow();
      prisma.input.findUnique.mockResolvedValue(row);
      prisma.input.update.mockResolvedValue(row);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('Forbidden'),
        headers: { get: jest.fn().mockReturnValue(null) },
      } as unknown as Response);

      const result = await service.test('input-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 403');
      expect(prisma.input.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastTestStatus: 'error' }),
        }),
      );
      expect(mockLogs.error).toHaveBeenCalled();
    });

    it('catches unexpected errors and records lastTestStatus = error', async () => {
      const row = makeInputRow();
      prisma.input.findUnique.mockResolvedValue(row);
      prisma.input.update.mockResolvedValue(row);

      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await service.test('input-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
      expect(prisma.input.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastTestStatus: 'error' }),
        }),
      );
    });

    it('returns count undefined when response is 2xx but not a JSON array', async () => {
      const row = makeInputRow({
        config: { baseUrl: 'https://api.example.com', listEndpoint: '/export', method: 'GET' },
      });
      prisma.input.findUnique.mockResolvedValue(row);
      prisma.input.update.mockResolvedValue(row);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('not-json'),
        headers: { get: jest.fn().mockReturnValue(null) },
      } as unknown as Response);

      const result = await service.test('input-1');

      expect(result.success).toBe(true);
      expect(result.count).toBeUndefined();
    });
  });

  // ─── extractExt ──────────────────────────────────────────────────────────────

  describe('extractExt', () => {
    it('returns .tar.gz for compound extension', () => {
      expect(priv().extractExt('portainer_backup.tar.gz')).toBe('.tar.gz');
    });

    it('returns .tar.bz2 for compound extension', () => {
      expect(priv().extractExt('archive.tar.bz2')).toBe('.tar.bz2');
    });

    it('returns .tar.xz for compound extension', () => {
      expect(priv().extractExt('archive.tar.xz')).toBe('.tar.xz');
    });

    it('returns simple extension for .json', () => {
      expect(priv().extractExt('data.json')).toBe('.json');
    });

    it('returns simple extension for .zip', () => {
      expect(priv().extractExt('archive.zip')).toBe('.zip');
    });

    it('returns empty string when filename has no extension', () => {
      expect(priv().extractExt('noextension')).toBe('');
    });

    it('normalises compound extension to lowercase', () => {
      expect(priv().extractExt('FILE.TAR.GZ')).toBe('.tar.gz');
    });

    it('normalises simple extension to lowercase', () => {
      expect(priv().extractExt('FILE.ZIP')).toBe('.zip');
    });

    it('returns empty string for a leading-dot filename (no real extension)', () => {
      expect(priv().extractExt('.')).toBe('');
    });
  });

  // ─── detectFileExtension ─────────────────────────────────────────────────────

  describe('detectFileExtension', () => {
    describe('Priority 1 — Content-Disposition header', () => {
      it('extracts extension from double-quoted filename', () => {
        expect(
          priv().detectFileExtension(
            'attachment; filename="portainer_backup.tar.gz"',
            null,
          ),
        ).toBe('.tar.gz');
      });

      it('extracts extension from single-quoted filename', () => {
        expect(
          priv().detectFileExtension(
            "attachment; filename='backup.zip'",
            null,
          ),
        ).toBe('.zip');
      });

      it('extracts extension from unquoted filename', () => {
        expect(
          priv().detectFileExtension(
            'attachment; filename=backup.tar.bz2',
            null,
          ),
        ).toBe('.tar.bz2');
      });

      it('handles RFC 5987 filename*= syntax (no encoding prefix)', () => {
        expect(
          priv().detectFileExtension(
            'attachment; filename*=backup.tar.gz',
            null,
          ),
        ).toBe('.tar.gz');
      });

      it('handles RFC 5987 UTF-8 prefix and URL-decodes the name', () => {
        expect(
          priv().detectFileExtension(
            "attachment; filename*=UTF-8''my%20backup.json",
            null,
          ),
        ).toBe('.json');
      });

      it('takes priority over Content-Type when both are present', () => {
        expect(
          priv().detectFileExtension(
            'attachment; filename="snapshot.tar.gz"',
            'application/zip',
          ),
        ).toBe('.tar.gz');
      });
    });

    describe('Priority 2 — Content-Type mapping', () => {
      it('returns .zip for application/zip', () => {
        expect(priv().detectFileExtension(null, 'application/zip')).toBe('.zip');
      });

      it('returns .zip for application/x-zip-compressed', () => {
        expect(
          priv().detectFileExtension(null, 'application/x-zip-compressed'),
        ).toBe('.zip');
      });

      it('returns .tar.gz for application/gzip', () => {
        expect(priv().detectFileExtension(null, 'application/gzip')).toBe('.tar.gz');
      });

      it('returns .tar.gz for application/x-gzip', () => {
        expect(priv().detectFileExtension(null, 'application/x-gzip')).toBe('.tar.gz');
      });

      it('returns .tar.bz2 for application/x-bzip2', () => {
        expect(priv().detectFileExtension(null, 'application/x-bzip2')).toBe('.tar.bz2');
      });

      it('returns .json for application/json', () => {
        expect(priv().detectFileExtension(null, 'application/json')).toBe('.json');
      });

      it('returns .csv for text/csv', () => {
        expect(priv().detectFileExtension(null, 'text/csv')).toBe('.csv');
      });

      it('strips charset suffix before looking up Content-Type', () => {
        expect(
          priv().detectFileExtension(null, 'application/json; charset=utf-8'),
        ).toBe('.json');
      });
    });

    describe('Priority 3 — URL path fallback', () => {
      it('extracts compound extension from URL path', () => {
        expect(
          priv().detectFileExtension(
            null,
            'application/octet-stream',
            'https://nas.local/api/backup.tar.gz',
          ),
        ).toBe('.tar.gz');
      });

      it('returns empty string when URL has no extension in path', () => {
        expect(
          priv().detectFileExtension(
            null,
            'application/octet-stream',
            'https://nas.local/api/download',
          ),
        ).toBe('');
      });
    });

    describe('no match at all', () => {
      it('returns empty string when all sources are null/empty', () => {
        expect(priv().detectFileExtension(null, null)).toBe('');
      });

      it('returns empty string for unknown Content-Type with no URL', () => {
        expect(
          priv().detectFileExtension(null, 'application/octet-stream'),
        ).toBe('');
      });

      it('returns empty string when Content-Disposition has no filename', () => {
        expect(priv().detectFileExtension('inline', null)).toBe('');
      });
    });
  });
});
