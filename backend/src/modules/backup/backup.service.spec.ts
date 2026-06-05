import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';

const mockLogs = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const NOW = new Date('2026-01-01T00:00:00.000Z');

function makeOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'out-1',
    backupId: 'backup-1',
    type: 'mail',
    vaultId: 'vault-1',
    templateId: null,
    recipientsTo: [],
    recipientsCc: [],
    recipientsBcc: [],
    overrideSubject: null,
    overrideBody: null,
    overrideBodyType: null,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeBackupRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'backup-1',
    name: 'My Backup',
    sources: { sources: [{ path: '/data', type: 'folder', exclude: [] }] },
    scheduleType: 'manual',
    scheduleConfig: null,
    schedule: null,
    enabled: false,
    archiveFormat: 'zip',
    zipCompression: 'default',
    zipPassword: null,
    zipFilename: null,
    isValidated: false,
    validationStatus: null,
    validationError: null,
    validatedAt: null,
    lastRunAt: null,
    lastStatus: null,
    outputs: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeMockPrisma() {
  const txBackupUpdate = jest.fn();
  const txOutputDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const tx = {
    backup: { update: txBackupUpdate },
    backupOutput: { deleteMany: txOutputDeleteMany },
  };

  const prisma = {
    backup: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx) as unknown),
    _tx: tx,
    _txBackupUpdate: txBackupUpdate,
    _txOutputDeleteMany: txOutputDeleteMany,
  };
  return prisma;
}

describe('BackupService', () => {
  let service: BackupService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LogsWriter, useValue: mockLogs },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
  });

  describe('list', () => {
    it('returns all backups formatted as BackupData', async () => {
      mockPrisma.backup.findMany.mockResolvedValue([
        makeBackupRow({ id: 'b1', name: 'Alpha' }),
        makeBackupRow({ id: 'b2', name: 'Beta' }),
      ]);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Beta');
    });

    it('returns empty array when no backups exist', async () => {
      mockPrisma.backup.findMany.mockResolvedValue([]);
      expect(await service.list()).toEqual([]);
    });

    it('parses sources from JSON field', async () => {
      mockPrisma.backup.findMany.mockResolvedValue([
        makeBackupRow({
          sources: { sources: [{ path: '/home', type: 'folder', exclude: ['*.tmp'] }] },
        }),
      ]);

      const [backup] = await service.list();
      expect(backup.sources.sources[0].path).toBe('/home');
      expect(backup.sources.sources[0].exclude).toEqual(['*.tmp']);
    });
  });

  describe('create', () => {
    it('creates a backup and always sets enabled to false', async () => {
      const row = makeBackupRow({ name: 'New Backup' });
      mockPrisma.backup.create.mockResolvedValue(row);

      const result = await service.create({ name: 'New Backup' });

      expect(result.name).toBe('New Backup');
      expect(result.enabled).toBe(false);
      const createArg = (mockPrisma.backup.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0];
      expect(createArg.data.enabled).toBe(false);
    });

    it('maps provided outputs', async () => {
      const row = makeBackupRow({ outputs: [makeOutput({ vaultId: 'v-1', recipientsTo: ['c-1'] })] });
      mockPrisma.backup.create.mockResolvedValue(row);

      const result = await service.create({
        name: 'With Output',
        outputs: [{ type: 'mail', vaultId: 'v-1', recipientsTo: ['c-1'] }],
      });

      expect(result.outputs[0].vaultId).toBe('v-1');
      expect(result.outputs[0].recipientsTo).toEqual(['c-1']);
    });

    it('defaults archiveFormat to zip and zipCompression to default', async () => {
      mockPrisma.backup.create.mockResolvedValue(makeBackupRow({ archiveFormat: 'zip', zipCompression: 'default' }));
      await service.create({ name: 'Backup' });
      const createArg = (mockPrisma.backup.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0];
      expect(createArg.data.archiveFormat).toBe('zip');
      expect(createArg.data.zipCompression).toBe('default');
    });
  });

  describe('getOne', () => {
    it('returns a backup by id', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue(makeBackupRow({ id: 'b-42', name: 'Found' }));

      const result = await service.getOne('b-42');

      expect(result.id).toBe('b-42');
      expect(result.name).toBe('Found');
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue(null);

      await expect(service.getOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates the backup name', async () => {
      const existing = makeBackupRow();
      mockPrisma.backup.findUnique
        .mockResolvedValueOnce(existing) // exists check
        .mockResolvedValueOnce(null);    // name conflict check
      const updated = makeBackupRow({ name: 'Renamed' });
      mockPrisma._txBackupUpdate.mockResolvedValue(updated);

      const result = await service.update('backup-1', { name: 'Renamed' });

      expect(result.name).toBe('Renamed');
    });

    it('throws NotFoundException when backup does not exist', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue(null);

      await expect(service.update('ghost', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when new name is already taken by another backup', async () => {
      const existing = makeBackupRow({ id: 'b-1', name: 'Old Name' });
      const conflicting = makeBackupRow({ id: 'b-2', name: 'Taken Name' });
      mockPrisma.backup.findUnique
        .mockResolvedValueOnce(existing)    // exists check
        .mockResolvedValueOnce(conflicting); // name conflict check

      await expect(service.update('b-1', { name: 'Taken Name' })).rejects.toThrow(ConflictException);
    });

    it('preserves zipPassword when not included in the update DTO', async () => {
      const existing = makeBackupRow({ zipPassword: 'existing-secret' });
      mockPrisma.backup.findUnique
        .mockResolvedValueOnce(existing) // exists check
        .mockResolvedValueOnce(null);    // name conflict check — no conflict
      const updated = makeBackupRow({ name: 'New Name', zipPassword: 'existing-secret' });
      mockPrisma._txBackupUpdate.mockResolvedValue(updated);

      await service.update('backup-1', { name: 'New Name' }); // zipPassword absent du DTO

      const updateArg = (mockPrisma._txBackupUpdate.mock.calls[0] as [{ data: Record<string, unknown> }])[0];
      // dto.zipPassword is undefined → should fall back to existing value
      expect(updateArg.data.zipPassword).toBe('existing-secret');
    });

    it('clears zipPassword when explicitly set to null', async () => {
      const existing = makeBackupRow({ zipPassword: 'old-secret' });
      mockPrisma.backup.findUnique.mockResolvedValue(existing);
      const updated = makeBackupRow({ zipPassword: null });
      mockPrisma._txBackupUpdate.mockResolvedValue(updated);

      await service.update('backup-1', { zipPassword: null });

      const updateArg = (mockPrisma._txBackupUpdate.mock.calls[0] as [{ data: Record<string, unknown> }])[0];
      expect(updateArg.data.zipPassword).toBeNull();
    });

    it('sets a new zipPassword when provided', async () => {
      const existing = makeBackupRow({ zipPassword: null });
      mockPrisma.backup.findUnique.mockResolvedValue(existing);
      const updated = makeBackupRow({ zipPassword: 'new-password' });
      mockPrisma._txBackupUpdate.mockResolvedValue(updated);

      await service.update('backup-1', { zipPassword: 'new-password' });

      const updateArg = (mockPrisma._txBackupUpdate.mock.calls[0] as [{ data: Record<string, unknown> }])[0];
      expect(updateArg.data.zipPassword).toBe('new-password');
    });

    it('resets isValidated and disables backup when config fields change', async () => {
      const existing = makeBackupRow({ isValidated: true, enabled: true });
      mockPrisma.backup.findUnique.mockResolvedValue(existing);
      const updated = makeBackupRow({ isValidated: false, enabled: false });
      mockPrisma._txBackupUpdate.mockResolvedValue(updated);

      await service.update('backup-1', { archiveFormat: 'tar' });

      const updateArg = (mockPrisma._txBackupUpdate.mock.calls[0] as [{ data: Record<string, unknown> }])[0];
      expect(updateArg.data.isValidated).toBe(false);
      expect(updateArg.data.enabled).toBe(false);
    });

    it('does not reset validation when only the name changes', async () => {
      const existing = makeBackupRow({ isValidated: true, enabled: true });
      mockPrisma.backup.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      const updated = makeBackupRow({ name: 'New Name', isValidated: true, enabled: true });
      mockPrisma._txBackupUpdate.mockResolvedValue(updated);

      await service.update('backup-1', { name: 'New Name' });

      const updateArg = (mockPrisma._txBackupUpdate.mock.calls[0] as [{ data: Record<string, unknown> }])[0];
      expect(updateArg.data.isValidated).toBeUndefined();
    });

    it('throws BadRequestException when enabling a non-validated backup', async () => {
      const existing = makeBackupRow({ isValidated: false, enabled: false });
      mockPrisma.backup.findUnique.mockResolvedValue(existing);

      await expect(service.update('backup-1', { enabled: true })).rejects.toThrow(BadRequestException);
    });

    it('replaces outputs when dto.outputs is provided', async () => {
      const existing = makeBackupRow({ outputs: [makeOutput()] });
      mockPrisma.backup.findUnique.mockResolvedValue(existing);
      const newOutput = makeOutput({ id: 'out-new', vaultId: 'v-2' });
      const updated = makeBackupRow({ outputs: [newOutput] });
      mockPrisma._txBackupUpdate.mockResolvedValue(updated);

      await service.update('backup-1', {
        outputs: [{ type: 'mail', vaultId: 'v-2' }],
      });

      expect(mockPrisma._txOutputDeleteMany).toHaveBeenCalledWith({ where: { backupId: 'backup-1' } });
    });

    it('preserves recipients when updating outputs', async () => {
      const existing = makeBackupRow();
      mockPrisma.backup.findUnique.mockResolvedValue(existing);
      const updated = makeBackupRow({
        outputs: [makeOutput({ recipientsTo: ['contact-1', 'contact-2'] })],
      });
      mockPrisma._txBackupUpdate.mockResolvedValue(updated);

      const result = await service.update('backup-1', {
        outputs: [{ type: 'mail', vaultId: 'v-1', recipientsTo: ['contact-1', 'contact-2'] }],
      });

      expect(result.outputs[0].recipientsTo).toEqual(['contact-1', 'contact-2']);
    });
  });

  describe('delete', () => {
    it('deletes a backup by id', async () => {
      const row = makeBackupRow();
      mockPrisma.backup.findUnique.mockResolvedValue(row);
      mockPrisma.backup.delete.mockResolvedValue(row);

      await service.delete('backup-1');

      expect(mockPrisma.backup.delete).toHaveBeenCalledWith({ where: { id: 'backup-1' } });
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue(null);

      await expect(service.delete('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('startValidation', () => {
    it('sets validationStatus to running', async () => {
      const row = makeBackupRow();
      mockPrisma.backup.findUnique.mockResolvedValue(row);
      mockPrisma.backup.update.mockResolvedValue({ ...row, validationStatus: 'running' });

      await service.startValidation('backup-1');

      expect(mockPrisma.backup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'backup-1' },
          data: expect.objectContaining({ validationStatus: 'running', isValidated: false }),
        }),
      );
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue(null);

      await expect(service.startValidation('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findEnabledWithSchedule', () => {
    it('returns only enabled backups with a non-manual schedule', async () => {
      mockPrisma.backup.findMany.mockResolvedValue([
        makeBackupRow({ id: 'b-1', scheduleType: 'recurring', schedule: '0 3 * * 1,2,3', enabled: true }),
      ]);

      const result = await service.findEnabledWithSchedule();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b-1');
      expect(result[0].schedule).toBe('0 3 * * 1,2,3');
    });

    it('returns empty when no enabled backups exist', async () => {
      mockPrisma.backup.findMany.mockResolvedValue([]);
      expect(await service.findEnabledWithSchedule()).toEqual([]);
    });
  });
});
