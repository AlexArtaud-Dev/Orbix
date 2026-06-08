import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';
import type { CreateBackupDto } from './dto/create-backup.dto';
import type { UpdateBackupDto } from './dto/update-backup.dto';
import {
  parseBackupSources,
  parseScheduleConfig,
  type BackupData,
  type ScheduleConfig,
} from './backup.types';

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
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface BackupRow {
  id: string;
  name: string;
  sources: unknown;
  scheduleType: string;
  scheduleConfig: unknown;
  schedule: string | null;
  enabled: boolean;
  archiveFormat: string;
  zipCompression: string;
  zipPassword: string | null;
  zipFilename: string | null;
  isValidated: boolean;
  validationStatus: string | null;
  validationError: string | null;
  validatedAt: Date | null;
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
      scheduleType: backup.scheduleType,
      scheduleConfig: parseScheduleConfig(backup.scheduleConfig),
      schedule: backup.schedule,
      enabled: backup.enabled,
      archiveFormat: backup.archiveFormat,
      zipCompression: backup.zipCompression,
      zipPassword: backup.zipPassword,
      zipFilename: backup.zipFilename,
      isValidated: backup.isValidated,
      validationStatus: backup.validationStatus,
      validationError: backup.validationError,
      validatedAt: backup.validatedAt?.toISOString() ?? null,
      lastRunAt: backup.lastRunAt?.toISOString() ?? null,
      lastStatus: backup.lastStatus,
      outputs: [...backup.outputs]
        .sort((a, b) => a.order - b.order)
        .map((o) => ({
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
          order: o.order,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
        })),
      createdAt: backup.createdAt.toISOString(),
      updatedAt: backup.updatedAt.toISOString(),
    };
  }

  private mapOutputCreate(
    o: NonNullable<CreateBackupDto['outputs']>[number],
    idx: number,
  ) {
    return {
      type: o.type,
      vaultId: o.vaultId,
      templateId: o.templateId ?? null,
      recipientsTo: o.recipientsTo ?? [],
      recipientsCc: o.recipientsCc ?? [],
      recipientsBcc: o.recipientsBcc ?? [],
      overrideSubject: o.overrideSubject ?? null,
      overrideBody: o.overrideBody ?? null,
      overrideBodyType: o.overrideBodyType ?? null,
      order: o.order ?? idx,
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

    const sources = dto.sources
      ? {
          sources: dto.sources.sources.map((s) => ({
            path: s.path,
            type: s.type,
            exclude: s.exclude ?? [],
          })),
        }
      : { sources: [] };

    const backup = await this.prisma.backup.create({
      data: {
        name: dto.name,

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        sources: sources as any,
        scheduleType: dto.scheduleType ?? 'manual',

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        scheduleConfig: (dto.scheduleConfig ?? null) as any,
        schedule: dto.schedule ?? null,
        enabled: false, // always false on create — requires validation
        archiveFormat: dto.archiveFormat ?? 'zip',
        zipCompression: dto.zipCompression ?? 'default',
        zipPassword: dto.zipPassword ?? null,
        zipFilename: dto.zipFilename ?? null,
        outputs: dto.outputs
          ? { create: dto.outputs.map((o, i) => this.mapOutputCreate(o, i)) }
          : undefined,
      },
      include: { outputs: true },
    });

    this.logs.info('backup', 'BACKUP_CREATED', `Backup created: ${dto.name}`);
    return this.toData(backup);
  }

  async getOne(id: string): Promise<BackupData> {
    const backup = await this.prisma.backup.findUnique({
      where: { id },
      include: { outputs: true },
    });
    if (!backup) throw new NotFoundException();
    return this.toData(backup);
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

    // Any config change resets validation and disables the backup
    const configChanged =
      dto.sources !== undefined ||
      dto.scheduleType !== undefined ||
      dto.scheduleConfig !== undefined ||
      dto.schedule !== undefined ||
      dto.archiveFormat !== undefined ||
      dto.zipCompression !== undefined ||
      dto.zipPassword !== undefined ||
      dto.zipFilename !== undefined ||
      dto.outputs !== undefined;

    if (
      dto.enabled === true &&
      !(existing as BackupRow).isValidated &&
      !configChanged
    ) {
      throw new BadRequestException(
        'Cannot enable a backup that has not passed validation',
      );
    }

    const sources = dto.sources
      ? {
          sources: dto.sources.sources.map((s) => ({
            path: s.path,
            type: s.type,
            exclude: s.exclude ?? [],
          })),
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

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          sources: (sources ?? existing.sources) as any,
          scheduleType:
            dto.scheduleType ?? (existing as BackupRow).scheduleType,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          scheduleConfig:
            dto.scheduleConfig !== undefined
              ? (dto.scheduleConfig as any)
              : (existing as BackupRow).scheduleConfig,
          schedule:
            dto.schedule !== undefined ? dto.schedule : existing.schedule,
          enabled: configChanged ? false : (dto.enabled ?? existing.enabled),
          archiveFormat:
            dto.archiveFormat ?? (existing as BackupRow).archiveFormat,
          zipCompression:
            dto.zipCompression ?? (existing as BackupRow).zipCompression,
          zipPassword:
            dto.zipPassword !== undefined
              ? dto.zipPassword
              : (existing as BackupRow).zipPassword,
          zipFilename:
            dto.zipFilename !== undefined
              ? dto.zipFilename
              : (existing as BackupRow).zipFilename,
          ...(configChanged
            ? {
                isValidated: false,
                validationStatus: null,
                validationError: null,
                validatedAt: null,
              }
            : {}),
          outputs:
            dto.outputs !== undefined
              ? {
                  create: dto.outputs.map((o, i) => this.mapOutputCreate(o, i)),
                }
              : undefined,
        },
        include: { outputs: true },
      });
    });

    this.logs.info(
      'backup',
      'BACKUP_UPDATED',
      `Backup updated: ${backup.name}`,
    );
    return this.toData(backup);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.backup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.backup.delete({ where: { id } });
    this.logs.info(
      'backup',
      'BACKUP_DELETED',
      `Backup deleted: ${existing.name}`,
    );
  }

  async startValidation(id: string): Promise<void> {
    const existing = await this.prisma.backup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.backup.update({
      where: { id },
      data: {
        validationStatus: 'running',
        isValidated: false,
        validationError: null,
      },
    });
  }

  async findEnabledWithSchedule(): Promise<
    {
      id: string;
      name: string;
      scheduleType: string;
      schedule: string | null;
      scheduleConfig: ScheduleConfig;
    }[]
  > {
    const items = await this.prisma.backup.findMany({
      where: { enabled: true, scheduleType: { not: 'manual' } },
      select: {
        id: true,
        name: true,
        scheduleType: true,
        schedule: true,
        scheduleConfig: true,
      },
    });
    return items.map((b) => ({
      id: b.id,
      name: b.name,
      scheduleType: b.scheduleType,
      schedule: b.schedule,
      scheduleConfig: parseScheduleConfig(b.scheduleConfig),
    }));
  }
}
