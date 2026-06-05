import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';
import type { CreateBackupDto } from './dto/create-backup.dto';
import type { UpdateBackupDto } from './dto/update-backup.dto';
import { parseBackupSources } from './backup.types';
import type { BackupData, BackupSources } from './backup.types';

interface OutputRow {
  id: string;
  backupId: string;
  type: string;
  vaultId: string;
  templateId: string | null;
  recipientsTo: string[];
  recipientsCc: string[];
  recipientsBcc: string[];
  overrideSubject: string | null;
  overrideBody: string | null;
  overrideBodyType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface BackupRow {
  id: string;
  name: string;
  sources: unknown;
  compression: string;
  schedule: string | null;
  enabled: boolean;
  lastRunAt: Date | null;
  lastStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  outputs: OutputRow[];
}

@Injectable()
export class BackupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogsWriter,
  ) {}

  private toData(backup: BackupRow): BackupData {
    return {
      id: backup.id,
      name: backup.name,
      sources: parseBackupSources(backup.sources),
      compression: backup.compression,
      schedule: backup.schedule,
      enabled: backup.enabled,
      lastRunAt: backup.lastRunAt?.toISOString() ?? null,
      lastStatus: backup.lastStatus,
      outputs: backup.outputs.map((o) => ({
        id: o.id,
        backupId: o.backupId,
        type: o.type,
        vaultId: o.vaultId,
        templateId: o.templateId,
        recipientsTo: o.recipientsTo,
        recipientsCc: o.recipientsCc,
        recipientsBcc: o.recipientsBcc,
        overrideSubject: o.overrideSubject,
        overrideBody: o.overrideBody,
        overrideBodyType: o.overrideBodyType,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      createdAt: backup.createdAt.toISOString(),
      updatedAt: backup.updatedAt.toISOString(),
    };
  }

  async list(): Promise<BackupData[]> {
    const items = await this.prisma.backup.findMany({
      include: { outputs: true },
      orderBy: { name: 'asc' },
    });
    return items.map((b) => this.toData(b as BackupRow));
  }

  async create(dto: CreateBackupDto): Promise<BackupData> {
    const existing = await this.prisma.backup.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Name already in use');

    const sources = {
      paths: dto.sources.paths,
      exclude: dto.sources.exclude ?? [],
    };

    const backup = await this.prisma.backup.create({
      data: {
        name: dto.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sources: sources as any,
        compression: dto.compression ?? 'auto',
        schedule: dto.schedule ?? null,
        enabled: dto.enabled ?? true,
        outputs: dto.outputs
          ? {
              create: dto.outputs.map((o) => ({
                type: o.type,
                vaultId: o.vaultId,
                templateId: o.templateId ?? null,
                recipientsTo: o.recipientsTo,
                recipientsCc: o.recipientsCc ?? [],
                recipientsBcc: o.recipientsBcc ?? [],
                overrideSubject: o.overrideSubject ?? null,
                overrideBody: o.overrideBody ?? null,
                overrideBodyType: o.overrideBodyType ?? null,
              })),
            }
          : undefined,
      },
      include: { outputs: true },
    });

    this.logs.info('backup', 'BACKUP_CREATED', `Backup created: ${dto.name}`);
    return this.toData(backup as BackupRow);
  }

  async getOne(id: string): Promise<BackupData> {
    const backup = await this.prisma.backup.findUnique({
      where: { id },
      include: { outputs: true },
    });
    if (!backup) throw new NotFoundException();
    return this.toData(backup as BackupRow);
  }

  async update(id: string, dto: UpdateBackupDto): Promise<BackupData> {
    const existing = await this.prisma.backup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();

    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.backup.findUnique({
        where: { name: dto.name },
      });
      if (conflict) throw new ConflictException('Name already in use');
    }

    const existingSources = parseBackupSources(existing.sources);
    const sources = dto.sources
      ? {
          paths: dto.sources.paths ?? existingSources.paths,
          exclude: dto.sources.exclude ?? existingSources.exclude ?? [],
        }
      : null;

    const backup = await this.prisma.$transaction(async (tx) => {
      if (dto.outputs !== undefined) {
        await tx.backupOutput.deleteMany({ where: { backupId: id } });
      }

      return tx.backup.update({
        where: { id },
        data: {
          name: dto.name ?? existing.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sources: (sources ?? existing.sources) as any,
          compression: dto.compression ?? existing.compression,
          schedule:
            dto.schedule !== undefined ? dto.schedule : existing.schedule,
          enabled: dto.enabled ?? existing.enabled,
          outputs:
            dto.outputs !== undefined
              ? {
                  create: dto.outputs.map((o) => ({
                    type: o.type,
                    vaultId: o.vaultId,
                    templateId: o.templateId ?? null,
                    recipientsTo: o.recipientsTo,
                    recipientsCc: o.recipientsCc ?? [],
                    recipientsBcc: o.recipientsBcc ?? [],
                    overrideSubject: o.overrideSubject ?? null,
                    overrideBody: o.overrideBody ?? null,
                    overrideBodyType: o.overrideBodyType ?? null,
                  })),
                }
              : undefined,
        },
        include: { outputs: true },
      });
    });

    this.logs.info('backup', 'BACKUP_UPDATED', `Backup updated: ${backup.name}`);
    return this.toData(backup as BackupRow);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.backup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.backup.delete({ where: { id } });
    this.logs.info('backup', 'BACKUP_DELETED', `Backup deleted: ${existing.name}`);
  }

  async findEnabledWithSchedule(): Promise<
    { id: string; name: string; schedule: string }[]
  > {
    const items = await this.prisma.backup.findMany({
      where: { enabled: true, schedule: { not: null } },
      select: { id: true, name: true, schedule: true },
    });
    return items.map((b) => ({
      id: b.id,
      name: b.name,
      schedule: b.schedule as string,
    }));
  }
}
