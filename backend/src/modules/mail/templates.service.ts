import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';
import type { CreateTemplateDto } from './dto/create-template.dto';
import type { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogsWriter,
  ) {}

  async list(cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);
    const items = await this.prisma.mailTemplate.findMany({
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { name: 'asc' },
    });
    const hasNext = items.length > take;
    const page = items.slice(0, take);
    return { data: page, nextCursor: hasNext ? page[page.length - 1].id : null };
  }

  async create(dto: CreateTemplateDto) {
    const existing = await this.prisma.mailTemplate.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Name already in use');
    const template = await this.prisma.mailTemplate.create({
      data: { name: dto.name, subject: dto.subject, body: dto.body, bodyType: dto.bodyType ?? 'text' },
    });
    this.logs.info('mail', 'MAIL_TEMPLATE_CREATED', `Template created: ${dto.name}`);
    return template;
  }

  async getOne(id: string) {
    const t = await this.prisma.mailTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    return t;
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const t = await this.prisma.mailTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    if (dto.name && dto.name !== t.name) {
      const conflict = await this.prisma.mailTemplate.findUnique({ where: { name: dto.name } });
      if (conflict) throw new ConflictException('Name already in use');
    }
    const updated = await this.prisma.mailTemplate.update({
      where: { id },
      data: {
        name: dto.name ?? t.name,
        subject: dto.subject ?? t.subject,
        body: dto.body ?? t.body,
        bodyType: dto.bodyType ?? t.bodyType,
      },
    });
    this.logs.info('mail', 'MAIL_TEMPLATE_UPDATED', `Template updated: ${updated.name}`);
    return updated;
  }

  async delete(id: string) {
    const t = await this.prisma.mailTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    await this.prisma.mailTemplate.delete({ where: { id } });
    this.logs.info('mail', 'MAIL_TEMPLATE_DELETED', `Template deleted: ${t.name}`);
  }
}
