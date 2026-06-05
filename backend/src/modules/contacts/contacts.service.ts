import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateContactDto } from './dto/create-contact.dto';
import type { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);
    const items = await this.prisma.contact.findMany({
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { name: 'asc' },
    });
    const hasNext = items.length > take;
    const page = items.slice(0, take);
    return { data: page, nextCursor: hasNext ? page[page.length - 1].id : null };
  }

  async create(dto: CreateContactDto) {
    const existing = await this.prisma.contact.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');
    return this.prisma.contact.create({
      data: { name: dto.name, email: dto.email, tags: dto.tags ?? [] },
    });
  }

  async getOne(id: string) {
    const c = await this.prisma.contact.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    return c;
  }

  async update(id: string, dto: UpdateContactDto) {
    const c = await this.prisma.contact.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    if (dto.email && dto.email !== c.email) {
      const conflict = await this.prisma.contact.findUnique({ where: { email: dto.email } });
      if (conflict) throw new ConflictException('Email already in use');
    }
    return this.prisma.contact.update({
      where: { id },
      data: {
        name: dto.name ?? c.name,
        email: dto.email ?? c.email,
        tags: dto.tags ?? c.tags,
      },
    });
  }

  async delete(id: string) {
    const c = await this.prisma.contact.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    await this.prisma.contact.delete({ where: { id } });
  }
}
