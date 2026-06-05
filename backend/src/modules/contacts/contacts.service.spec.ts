import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../../prisma/prisma.service';

function makeMockPrisma() {
  return {
    contact: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeContact(id: string, name: string, email: string, tags: string[] = []) {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return { id, name, email, tags, createdAt: now, updatedAt: now };
}

describe('ContactsService', () => {
  let service: ContactsService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ContactsService>(ContactsService);
  });

  describe('create', () => {
    it('creates contact and returns it', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);
      mockPrisma.contact.create.mockResolvedValue(
        makeContact('id-1', 'Alice', 'alice@example.com', ['vip']),
      );

      const result = await service.create({ name: 'Alice', email: 'alice@example.com', tags: ['vip'] });

      expect(result.id).toBe('id-1');
      expect(result.name).toBe('Alice');
      expect(result.tags).toEqual(['vip']);
    });

    it('throws ConflictException when email already exists', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(
        makeContact('existing', 'Bob', 'bob@example.com'),
      );

      await expect(
        service.create({ name: 'Bob2', email: 'bob@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('defaults tags to empty array when not provided', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);
      mockPrisma.contact.create.mockImplementation(
        ({ data }: { data: { tags: string[] } }) =>
          Promise.resolve(makeContact('id-1', 'Alice', 'alice@example.com', data.tags)),
      );

      await service.create({ name: 'Alice', email: 'alice@example.com' });

      const createArg = (mockPrisma.contact.create.mock.calls[0] as [{ data: { tags: string[] } }])[0];
      expect(createArg.data.tags).toEqual([]);
    });
  });

  describe('list', () => {
    it('returns data and nextCursor null when no more pages', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        makeContact('id-1', 'Alice', 'alice@example.com'),
      ]);

      const result = await service.list();

      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when more items exist beyond the page', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        makeContact('id-1', 'Alice', 'alice@example.com'),
        makeContact('id-2', 'Bob', 'bob@example.com'),
      ]);

      const result = await service.list(undefined, 1);

      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBe('id-1');
    });
  });

  describe('getOne', () => {
    it('returns contact by id', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(
        makeContact('id-1', 'Alice', 'alice@example.com'),
      );

      const result = await service.getOne('id-1');

      expect(result.id).toBe('id-1');
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.getOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates name while keeping other fields', async () => {
      const existing = makeContact('id-1', 'Alice', 'alice@example.com', ['vip']);
      mockPrisma.contact.findUnique.mockResolvedValue(existing);
      mockPrisma.contact.update.mockResolvedValue(
        makeContact('id-1', 'Alice Updated', 'alice@example.com', ['vip']),
      );

      const result = await service.update('id-1', { name: 'Alice Updated' });

      expect(result.name).toBe('Alice Updated');
      expect(result.email).toBe('alice@example.com');
    });

    it('throws ConflictException when new email is already taken', async () => {
      mockPrisma.contact.findUnique
        .mockResolvedValueOnce(makeContact('id-1', 'Alice', 'alice@example.com'))
        .mockResolvedValueOnce(makeContact('id-2', 'Bob', 'bob@example.com'));

      await expect(
        service.update('id-1', { email: 'bob@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.update('ghost', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes contact by id', async () => {
      const c = makeContact('id-1', 'Alice', 'alice@example.com');
      mockPrisma.contact.findUnique.mockResolvedValue(c);
      mockPrisma.contact.delete.mockResolvedValue(c);

      await service.delete('id-1');

      expect(mockPrisma.contact.delete).toHaveBeenCalledWith({ where: { id: 'id-1' } });
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.delete('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
