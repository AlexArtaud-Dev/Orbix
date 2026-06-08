import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as nodePath from 'node:path';

jest.mock('node:fs', () => ({ existsSync: jest.fn() }));
jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
}));

import { FilesService } from './files.service';
import { SettingsService } from '../settings/settings.service';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';

const ROOT = nodePath.resolve('/test/root');

const mockExistsSync = fsSync.existsSync as jest.Mock;
const mockReaddir = fs.readdir as jest.Mock;
const mockStat = fs.stat as jest.Mock;

function mockSettings(filesRoot = ROOT) {
  return { get: jest.fn().mockResolvedValue({ filesRoot }) };
}

function makeDirent(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir, isFile: () => !isDir };
}

function makeStat(
  size: number,
  mtime = new Date('2026-01-01T00:00:00Z'),
  extra: Partial<{
    uid: number;
    gid: number;
    mode: number;
    birthtime: Date;
  }> = {},
) {
  return {
    size,
    mtime,
    birthtime: extra.birthtime ?? mtime,
    uid: extra.uid ?? 0,
    gid: extra.gid ?? 0,
    mode: extra.mode ?? 0o100644,
    isDirectory: () => false,
    isFile: () => true,
  };
}

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: SettingsService, useValue: mockSettings() },
      ],
    }).compile();
    service = module.get<FilesService>(FilesService);
  });

  describe('list', () => {
    it('returns sorted entries with dirs first', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        makeDirent('file-b.txt', false),
        makeDirent('dir-a', true),
        makeDirent('file-a.txt', false),
      ]);
      mockStat.mockResolvedValue(makeStat(100));

      const result = await service.list('');

      expect(result[0].name).toBe('dir-a');
      expect(result[0].isDir).toBe(true);
      expect(result[1].name).toBe('file-a.txt');
      expect(result[2].name).toBe('file-b.txt');
    });

    it('sets size null for directories', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([makeDirent('mydir', true)]);
      mockStat.mockResolvedValue(makeStat(0));

      const result = await service.list('');

      expect(result[0].size).toBeNull();
    });

    it('sets size for files', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([makeDirent('readme.md', false)]);
      mockStat.mockResolvedValue(makeStat(512));

      const result = await service.list('');

      expect(result[0].size).toBe(512);
    });

    it('throws NotFoundException when directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(service.list('')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException on path traversal', async () => {
      await expect(service.list('../../etc/passwd')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('stat', () => {
    it('returns file stat with correct fields', async () => {
      const mtime = new Date('2026-03-15T10:00:00Z');
      const birthtime = new Date('2026-01-01T00:00:00Z');
      mockStat.mockResolvedValue(
        makeStat(1024, mtime, {
          uid: 1000,
          gid: 1000,
          mode: 0o100644,
          birthtime,
        }),
      );

      const result = await service.stat('readme.md');

      expect(result.name).toBe('readme.md');
      expect(result.isDir).toBe(false);
      expect(result.size).toBe(1024);
      expect(result.itemCount).toBeNull();
      expect(result.extension).toBe('.md');
      expect(result.uid).toBe(1000);
      expect(result.gid).toBe(1000);
      expect(result.mode).toBe('644');
      expect(result.modifiedAt).toBe(mtime.toISOString());
      expect(result.createdAt).toBe(birthtime.toISOString());
    });

    it('returns directory stat with itemCount and total size', async () => {
      const mtime = new Date('2026-03-15T10:00:00Z');
      const dirStat = {
        size: 0,
        mtime,
        birthtime: mtime,
        uid: 0,
        gid: 0,
        mode: 0o040755,
        isDirectory: () => true,
        isFile: () => false,
      };
      const fileStat = makeStat(500);

      mockStat
        .mockResolvedValueOnce(dirStat) // top-level stat
        .mockResolvedValueOnce(fileStat) // a.txt
        .mockResolvedValueOnce(fileStat); // b.txt
      mockReaddir.mockResolvedValue([
        makeDirent('a.txt', false),
        makeDirent('b.txt', false),
      ]);

      const result = await service.stat('mydir');

      expect(result.isDir).toBe(true);
      expect(result.size).toBe(1000);
      expect(result.itemCount).toBe(2);
      expect(result.extension).toBeNull();
    });

    it('throws NotFoundException when path does not exist', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'));

      await expect(service.stat('ghost.txt')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException on path traversal', async () => {
      await expect(service.stat('../secret')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns null extension for files without extension', async () => {
      mockStat.mockResolvedValue(makeStat(100));

      const result = await service.stat('Makefile');

      expect(result.extension).toBeNull();
    });
  });
});
