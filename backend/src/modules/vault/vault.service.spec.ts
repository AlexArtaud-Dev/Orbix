import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VaultService } from './vault.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockNodemailer = require('nodemailer') as { createTransport: jest.Mock };

const mockLogs = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  exception: jest.fn(),
};

const TEST_KEY = 'test-vault-key-must-be-32-chars!!';

function makeMockPrisma() {
  return {
    vaultEntity: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    vaultHealthCheck: {
      upsert: jest.fn(),
    },
  };
}

function makeRow(id: string, name: string, encryptedPayload: string) {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id,
    name,
    type: 'email',
    encryptedPayload,
    healthCheck: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe('VaultService', () => {
  let service: VaultService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue(TEST_KEY) },
        },
        { provide: LogsWriter, useValue: mockLogs },
      ],
    }).compile();

    service = module.get<VaultService>(VaultService);
  });

  describe('createEmail', () => {
    it('creates entity and returns response without password field', async () => {
      mockPrisma.vaultEntity.findUnique.mockResolvedValue(null);
      mockPrisma.vaultEntity.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(
            makeRow(
              'id-1',
              data.name as string,
              data.encryptedPayload as string,
            ),
          ),
      );

      const result = await service.createEmail({
        name: 'test-smtp',
        host: 'smtp.example.com',
        port: 587,
        user: 'user@example.com',
        password: 'secret123',
        fromAddr: 'from@example.com',
        fromName: 'Test',
        secure: false,
      });

      expect(result.id).toBe('id-1');
      expect(result.name).toBe('test-smtp');
      expect(result.host).toBe('smtp.example.com');
      expect(result.user).toBe('user@example.com');
      expect('password' in result).toBe(false);
    });

    it('throws ConflictException when name is already taken', async () => {
      mockPrisma.vaultEntity.findUnique.mockResolvedValue(
        makeRow('existing-id', 'taken-name', 'payload'),
      );

      await expect(
        service.createEmail({
          name: 'taken-name',
          host: 'smtp.example.com',
          port: 587,
          user: 'user@example.com',
          password: 'secret',
          fromAddr: 'from@example.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listEmail', () => {
    it('returns paginated data and nextCursor null when no more pages', async () => {
      // Create a real encrypted payload via the service for realistic mock data
      let encryptedPayload = '';
      mockPrisma.vaultEntity.findUnique.mockResolvedValueOnce(null);
      mockPrisma.vaultEntity.create.mockImplementationOnce(
        ({ data }: { data: Record<string, unknown> }) => {
          encryptedPayload = data.encryptedPayload as string;
          return Promise.resolve(makeRow('id-1', 'smtp-a', encryptedPayload));
        },
      );
      await service.createEmail({
        name: 'smtp-a',
        host: 'smtp.a.com',
        port: 587,
        user: 'a@a.com',
        password: 'pw',
        fromAddr: 'a@a.com',
      });

      mockPrisma.vaultEntity.findMany.mockResolvedValue([
        makeRow('id-1', 'smtp-a', encryptedPayload),
      ]);

      const result = await service.listEmail();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('smtp-a');
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when more items exist beyond the page', async () => {
      // Create two encrypted payloads
      const payloads: string[] = [];
      for (let i = 0; i < 2; i++) {
        mockPrisma.vaultEntity.findUnique.mockResolvedValueOnce(null);
        mockPrisma.vaultEntity.create.mockImplementationOnce(
          ({ data }: { data: Record<string, unknown> }) => {
            payloads.push(data.encryptedPayload as string);
            return Promise.resolve(
              makeRow(`id-${i}`, `smtp-${i}`, data.encryptedPayload as string),
            );
          },
        );
        await service.createEmail({
          name: `smtp-${i}`,
          host: `smtp${i}.com`,
          port: 587,
          user: `u${i}@u.com`,
          password: 'pw',
          fromAddr: `u${i}@u.com`,
        });
      }

      // Return 2 rows for limit=1 (service adds +1 to detect next page)
      mockPrisma.vaultEntity.findMany.mockResolvedValue([
        makeRow('id-0', 'smtp-0', payloads[0]),
        makeRow('id-1', 'smtp-1', payloads[1]),
      ]);

      const result = await service.listEmail(undefined, 1);

      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBe('id-0');
    });
  });

  describe('updateEmail', () => {
    it('updates fields and keeps password when not provided', async () => {
      let encryptedPayload = '';
      mockPrisma.vaultEntity.findUnique.mockResolvedValueOnce(null);
      mockPrisma.vaultEntity.create.mockImplementationOnce(
        ({ data }: { data: Record<string, unknown> }) => {
          encryptedPayload = data.encryptedPayload as string;
          return Promise.resolve(
            makeRow('id-1', 'smtp-orig', encryptedPayload),
          );
        },
      );
      await service.createEmail({
        name: 'smtp-orig',
        host: 'smtp.orig.com',
        port: 587,
        user: 'user@orig.com',
        password: 'original-password',
        fromAddr: 'from@orig.com',
      });

      // findUnique returns existing entity
      const existingRow = makeRow('id-1', 'smtp-orig', encryptedPayload);
      mockPrisma.vaultEntity.findUnique.mockResolvedValue(existingRow);
      mockPrisma.vaultEntity.update.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(
            makeRow(
              'id-1',
              data.name as string,
              data.encryptedPayload as string,
            ),
          ),
      );

      const result = await service.updateEmail('id-1', {
        host: 'smtp.new.com',
      });

      expect(result.host).toBe('smtp.new.com');
      expect('password' in result).toBe(false);
      const updateArg = (
        mockPrisma.vaultEntity.update.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0];
      // Verify update was called with an encryptedPayload (password preserved)
      expect(typeof updateArg.data.encryptedPayload).toBe('string');
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.vaultEntity.findUnique.mockResolvedValue(null);
      await expect(
        service.updateEmail('unknown-id', { host: 'x.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteEmail', () => {
    it('deletes entity by id', async () => {
      const row = makeRow('id-1', 'smtp-del', 'payload');
      mockPrisma.vaultEntity.findUnique.mockResolvedValue(row);
      mockPrisma.vaultEntity.delete.mockResolvedValue(row);

      await service.deleteEmail('id-1');

      expect(mockPrisma.vaultEntity.delete).toHaveBeenCalledWith({
        where: { id: 'id-1' },
      });
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.vaultEntity.findUnique.mockResolvedValue(null);
      await expect(service.deleteEmail('ghost-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('testEmail', () => {
    async function setupEncryptedEntity(name: string, id: string) {
      let encryptedPayload = '';
      mockPrisma.vaultEntity.findUnique.mockResolvedValueOnce(null);
      mockPrisma.vaultEntity.create.mockImplementationOnce(
        ({ data }: { data: Record<string, unknown> }) => {
          encryptedPayload = data.encryptedPayload as string;
          return Promise.resolve(makeRow(id, name, encryptedPayload));
        },
      );
      await service.createEmail({
        name,
        host: 'smtp.test.com',
        port: 587,
        user: 'u@test.com',
        password: 'pw',
        fromAddr: 'f@test.com',
      });
      return encryptedPayload;
    }

    it('upserts healthCheck with status ok when SMTP verify succeeds', async () => {
      const encryptedPayload = await setupEncryptedEntity('smtp-ok', 'id-ok');
      const mockVerify = jest.fn().mockResolvedValue(undefined);
      mockNodemailer.createTransport.mockReturnValue({ verify: mockVerify });
      mockPrisma.vaultEntity.findUnique.mockResolvedValue(
        makeRow('id-ok', 'smtp-ok', encryptedPayload),
      );
      mockPrisma.vaultHealthCheck.upsert.mockResolvedValue({});

      await service.testEmail('id-ok');

      expect(mockPrisma.vaultHealthCheck.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { vaultId: 'id-ok' },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          create: expect.objectContaining({ status: 'ok', statusMsg: null }),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          update: expect.objectContaining({ status: 'ok', statusMsg: null }),
        }),
      );
    });

    it('upserts healthCheck with status error and throws HttpException when SMTP verify fails', async () => {
      const encryptedPayload = await setupEncryptedEntity('smtp-err', 'id-err');
      const mockVerify = jest
        .fn()
        .mockRejectedValue(new Error('Connection refused'));
      mockNodemailer.createTransport.mockReturnValue({ verify: mockVerify });
      mockPrisma.vaultEntity.findUnique.mockResolvedValue(
        makeRow('id-err', 'smtp-err', encryptedPayload),
      );
      mockPrisma.vaultHealthCheck.upsert.mockResolvedValue({});

      await expect(service.testEmail('id-err')).rejects.toThrow(HttpException);

      expect(mockPrisma.vaultHealthCheck.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { vaultId: 'id-err' },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          create: expect.objectContaining({
            status: 'error',
            statusMsg: 'Connection refused',
          }),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          update: expect.objectContaining({
            status: 'error',
            statusMsg: 'Connection refused',
          }),
        }),
      );
    });

    it('throws NotFoundException for unknown vault id', async () => {
      mockPrisma.vaultEntity.findUnique.mockResolvedValue(null);
      await expect(service.testEmail('ghost-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.vaultHealthCheck.upsert).not.toHaveBeenCalled();
    });
  });

  describe('checkAllEmail', () => {
    it('calls testEmail for every email entity', async () => {
      mockPrisma.vaultEntity.findMany.mockResolvedValue([
        makeRow('id-1', 'a', 'p'),
        makeRow('id-2', 'b', 'p'),
      ]);

      const spy = jest.spyOn(service, 'testEmail').mockResolvedValue(undefined);

      await service.checkAllEmail();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith('id-1');
      expect(spy).toHaveBeenCalledWith('id-2');
    });
  });
});
