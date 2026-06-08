import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import { LogsWriter } from '../logs/logs.writer';
import type { CreateInputDto } from './dto/create-input.dto';
import type { UpdateInputDto } from './dto/update-input.dto';
import type {
  HttpRestConfig,
  InputRequestParam,
  InputRow,
} from './input.types';

@Injectable()
export class InputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly logs: LogsWriter,
  ) {}

  async create(dto: CreateInputDto): Promise<InputRow> {
    try {
      const input = await this.prisma.input.create({
        data: {
          name: dto.name,
          type: dto.type,
          vaultId: dto.vaultId ?? null,
          config: (dto.config ?? {}) as Prisma.InputJsonValue,
          requestParams: (dto.requestParams ?? []) as Prisma.InputJsonValue,
          enabled: dto.enabled ?? true,
        },
      });
      return input as unknown as InputRow;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Input name already exists');
      }
      throw e;
    }
  }

  async list(
    cursor?: string,
    limit = 20,
  ): Promise<{ data: InputRow[]; nextCursor: string | null }> {
    const take = Math.min(limit, 100);
    const rows = await this.prisma.input.findMany({
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'asc' },
    });
    const hasMore = rows.length > take;
    const data = hasMore ? rows.slice(0, take) : rows;
    return {
      data: data as unknown as InputRow[],
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
    };
  }

  async getOne(id: string): Promise<InputRow> {
    const input = await this.prisma.input.findUnique({ where: { id } });
    if (!input) throw new NotFoundException('Input not found');
    return input as unknown as InputRow;
  }

  async update(id: string, dto: UpdateInputDto): Promise<InputRow> {
    const existing = await this.prisma.input.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Input not found');
    try {
      const updated = await this.prisma.input.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.config !== undefined
            ? { config: dto.config as Prisma.InputJsonValue }
            : {}),
          ...(dto.requestParams !== undefined
            ? { requestParams: dto.requestParams as Prisma.InputJsonValue }
            : {}),
          ...(dto.vaultId !== undefined
            ? { vaultId: dto.vaultId ?? null }
            : {}),
          ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        },
      });
      return updated as unknown as InputRow;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Input name already exists');
      }
      throw e;
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.input.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Input not found');
    await this.prisma.input.delete({ where: { id } });
    this.logs.info(
      'system',
      'INPUT_DELETED',
      `Input deleted: ${existing.name}`,
      undefined,
    );
  }

  async test(
    id: string,
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    const input = await this.prisma.input.findUnique({ where: { id } });
    if (!input) throw new NotFoundException('Input not found');

    const config = input.config as unknown as HttpRestConfig;
    const headers: Record<string, string> = {};

    try {
      // Apply vault auth (best-effort: only basic types)
      if (input.vaultId) {
        try {
          const payload = await this.vault.getHttpPayload(input.vaultId);
          this.applySimpleAuth(
            headers,
            payload as unknown as Record<string, unknown>,
          );
        } catch {
          // vault item missing or unsupported — continue without auth
        }
      }

      // Apply literal request params
      const params = (input.requestParams ??
        []) as unknown as InputRequestParam[];
      const target = config.listEndpoint
        ? config.listEndpoint.startsWith('http')
          ? config.listEndpoint
          : config.baseUrl.replace(/\/$/, '') +
            (config.listEndpoint.startsWith('/') ? '' : '/') +
            config.listEndpoint
        : config.baseUrl;

      const url = new URL(target);
      for (const param of params) {
        if (param.valueType === 'literal' && param.value) {
          if (param.in === 'header') headers[param.key] = param.value;
          else if (param.in === 'query')
            url.searchParams.set(param.key, param.value);
        }
      }

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        const error = `HTTP ${res.status}`;
        await this.prisma.input.update({
          where: { id },
          data: {
            lastTestAt: new Date(),
            lastTestStatus: 'error',
            lastTestError: error,
          },
        });
        return { success: false, error };
      }

      let count: number | undefined;
      if (config.listEndpoint) {
        try {
          const data = (await res.json()) as unknown;
          if (Array.isArray(data)) count = data.length;
        } catch {
          /* not JSON or not an array — that's fine */
        }
      }

      await this.prisma.input.update({
        where: { id },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: 'ok',
          lastTestError: null,
        },
      });
      return { success: true, count };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      await this.prisma.input.update({
        where: { id },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: 'error',
          lastTestError: error,
        },
      });
      return { success: false, error };
    }
  }

  private applySimpleAuth(
    headers: Record<string, string>,
    payload: Record<string, unknown>,
  ): void {
    switch (payload['subtype'] as string) {
      case 'token':
        headers['Authorization'] = `Bearer ${String(payload['token'])}`;
        break;
      case 'username_password':
        headers['Authorization'] = `Basic ${Buffer.from(
          `${String(payload['username'])}:${String(payload['password'])}`,
        ).toString('base64')}`;
        break;
      case 'key_secret':
        headers[payload['key'] as string] = payload['secret'] as string;
        break;
      case 'cookie':
        headers['Cookie'] = payload['value'] as string;
        break;
      case 'custom_kv': {
        const entries = payload['entries'] as Array<{
          key: string;
          value: string;
        }>;
        for (const { key, value } of entries) headers[key] = value;
        break;
      }
    }
  }
}
