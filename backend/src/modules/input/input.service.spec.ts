import { Test, TestingModule } from '@nestjs/testing';
import { InputService } from './input.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import { LogsWriter } from '../logs/logs.writer';

const mockLogs = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InputService,
        { provide: PrismaService, useValue: makeMockPrisma() },
        { provide: VaultService, useValue: { resolveTemplate: jest.fn() } },
        { provide: LogsWriter, useValue: mockLogs },
      ],
    }).compile();

    service = module.get<InputService>(InputService);
  });

  function priv(): ServicePrivate {
    return service as unknown as ServicePrivate;
  }

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
      // ".zip" with dot at position 0 — not considered an extension
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
        // CD says .tar.gz, CT says .zip — CD wins
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
        expect(priv().detectFileExtension(null, 'application/gzip')).toBe(
          '.tar.gz',
        );
      });

      it('returns .tar.gz for application/x-gzip', () => {
        expect(priv().detectFileExtension(null, 'application/x-gzip')).toBe(
          '.tar.gz',
        );
      });

      it('returns .tar.bz2 for application/x-bzip2', () => {
        expect(priv().detectFileExtension(null, 'application/x-bzip2')).toBe(
          '.tar.bz2',
        );
      });

      it('returns .json for application/json', () => {
        expect(priv().detectFileExtension(null, 'application/json')).toBe(
          '.json',
        );
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
        expect(
          priv().detectFileExtension('inline', null),
        ).toBe('');
      });
    });
  });
});
