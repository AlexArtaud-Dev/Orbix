import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    return this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
  }

  async update(dto: UpdateSettingsDto) {
    return this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...dto },
      update: dto,
    });
  }
}
