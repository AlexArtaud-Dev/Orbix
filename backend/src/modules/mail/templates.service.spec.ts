import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';

const mockLogs = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function makeMockPrisma() {
  return {
    mailTemplate: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeTemplate(id: string, name: string, bodyType = 'html') {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id,
    name,
    subject: `Subject for ${name}`,
    body: `<p>Body for ${name}</p>`,
    bodyType,
    createdAt: now,
    updatedAt: now,
  };
}

describe('TemplatesService', () => {
  let service: TemplatesService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LogsWriter, useValue: mockLogs },
      ],
    }).compile();
    service = module.get<TemplatesService>(TemplatesService);
  });

  describe('create', () => {
    it('creates template and returns it', async () => {
      mockPrisma.mailTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.mailTemplate.create.mockResolvedValue(makeTemplate('id-1', 'Welcome'));

      const result = await service.create({
        name: 'Welcome',
        subject: 'Welcome!',
        body: '<p>Hello</p>',
        bodyType: 'html',
      });

      expect(result.id).toBe('id-1');
      expect(result.name).toBe('Welcome');
    });

    it('defaults bodyType to text when not provided', async () => {
      mockPrisma.mailTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.mailTemplate.create.mockImplementation(
        ({ data }: { data: { bodyType: string } }) =>
          Promise.resolve(makeTemplate('id-1', 'T', data.bodyType)),
      );

      await service.create({ name: 'T', subject: 'S', body: 'B' });

      const arg = (mockPrisma.mailTemplate.create.mock.calls[0] as [{ data: { bodyType: string } }])[0];
      expect(arg.data.bodyType).toBe('text');
    });

    it('throws ConflictException when name already exists', async () => {
      mockPrisma.mailTemplate.findUnique.mockResolvedValue(makeTemplate('existing', 'Welcome'));

      await expect(
        service.create({ name: 'Welcome', subject: 'S', body: 'B' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('list', () => {
    it('returns data and nextCursor null when no more pages', async () => {
      mockPrisma.mailTemplate.findMany.mockResolvedValue([makeTemplate('id-1', 'T1')]);

      const result = await service.list();

      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when more items exist beyond the page', async () => {
      mockPrisma.mailTemplate.findMany.mockResolvedValue([
        makeTemplate('id-1', 'T1'),
        makeTemplate('id-2', 'T2'),
      ]);

      const result = await service.list(undefined, 1);

      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBe('id-1');
    });
  });

  describe('getOne', () => {
    it('returns template by id', async () => {
      mockPrisma.mailTemplate.findUnique.mockResolvedValue(makeTemplate('id-1', 'T'));

      const result = await service.getOne('id-1');

      expect(result.id).toBe('id-1');
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.mailTemplate.findUnique.mockResolvedValue(null);

      await expect(service.getOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates subject while keeping other fields', async () => {
      const existing = makeTemplate('id-1', 'T');
      mockPrisma.mailTemplate.findUnique.mockResolvedValue(existing);
      mockPrisma.mailTemplate.update.mockResolvedValue({ ...existing, subject: 'New subject' });

      const result = await service.update('id-1', { subject: 'New subject' });

      expect(result.subject).toBe('New subject');
      expect(result.name).toBe('T');
    });

    it('throws ConflictException when new name is already taken', async () => {
      mockPrisma.mailTemplate.findUnique
        .mockResolvedValueOnce(makeTemplate('id-1', 'T1'))
        .mockResolvedValueOnce(makeTemplate('id-2', 'T2'));

      await expect(
        service.update('id-1', { name: 'T2' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.mailTemplate.findUnique.mockResolvedValue(null);

      await expect(service.update('ghost', { subject: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes template by id', async () => {
      const t = makeTemplate('id-1', 'T');
      mockPrisma.mailTemplate.findUnique.mockResolvedValue(t);
      mockPrisma.mailTemplate.delete.mockResolvedValue(t);

      await service.delete('id-1');

      expect(mockPrisma.mailTemplate.delete).toHaveBeenCalledWith({ where: { id: 'id-1' } });
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.mailTemplate.findUnique.mockResolvedValue(null);

      await expect(service.delete('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
