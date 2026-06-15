import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import { LogsWriter } from '../logs/logs.writer';
import type { CreateInputDto } from './dto/create-input.dto';
import type { UpdateInputDto } from './dto/update-input.dto';
import { fetchWithConfig } from './input-http.util';
import type {
  HttpRestConfig,
  InputRequestParam,
  InputRow,
} from './input.types';
import { OrbixException } from '../../common/exceptions';
import { ModuleSettingsService } from '../module-settings/module-settings.service';

@Injectable()
export class InputService {
  private readonly logger = new Logger(InputService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly logs: LogsWriter,
    private readonly moduleSettings: ModuleSettingsService,
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

    // Config-affecting fields: invalidate test status so the input must be retested
    const configChanging =
      dto.config !== undefined ||
      dto.requestParams !== undefined ||
      dto.vaultId !== undefined;

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
          ...(configChanging
            ? { lastTestStatus: null, lastTestError: null, lastTestAt: null }
            : {}),
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

  async test(id: string): Promise<{
    success: boolean;
    count?: number;
    error?: string;
    errorCode?: string;
  }> {
    const input = await this.prisma.input.findUnique({ where: { id } });
    if (!input) throw new NotFoundException('Input not found');

    // Delegate SSH test to the SSH provider
    if (input.type === 'ssh') {
      try {
        const { SshInputProvider } =
          await import('../../providers/input/ssh/ssh-input.provider');
        const provider = new SshInputProvider(this.vault, this.moduleSettings);
        const result = await provider.test(
          input as unknown as import('./input.types').InputRow,
        );
        await this.prisma.input.update({
          where: { id },
          data: {
            lastTestAt: new Date(),
            lastTestStatus: result.success ? 'ok' : 'error',
            lastTestError: result.success ? null : (result.error ?? null),
          },
        });
        return result;
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

      const method = config.method ?? 'GET';

      // ── Build request body ────────────────────────────────────────────────
      let bodyString: string | undefined;
      if (config.body && config.body.type !== 'none') {
        switch (config.body.type) {
          case 'json':
            bodyString = config.body.json;
            if (!headers['Content-Type'] && !headers['content-type'])
              headers['Content-Type'] = 'application/json';
            break;
          case 'raw':
            bodyString = config.body.raw;
            break;
          case 'graphql': {
            let gqlVars: unknown;
            try {
              gqlVars = config.body.graphqlVariables
                ? JSON.parse(config.body.graphqlVariables)
                : undefined;
            } catch {
              gqlVars = undefined;
            }
            bodyString = JSON.stringify({
              query: config.body.raw,
              ...(gqlVars ? { variables: gqlVars } : {}),
            });
            if (!headers['Content-Type'] && !headers['content-type'])
              headers['Content-Type'] = 'application/json';
            break;
          }
          case 'x-www-form-urlencoded': {
            const params = new URLSearchParams();
            for (const f of config.body.urlEncoded ?? [])
              if (f.key && f.valueType === 'literal')
                params.set(f.key, f.value ?? '');
            bodyString = params.toString();
            if (!headers['Content-Type'] && !headers['content-type'])
              headers['Content-Type'] = 'application/x-www-form-urlencoded';
            break;
          }
          // form-data needs multipart boundaries — skip for test
        }
      }

      // ── Resolve vault variables in body ──────────────────────────────────
      if (bodyString !== undefined) {
        bodyString = await this.resolveTemplate(bodyString);
      }

      const res = await fetchWithConfig(
        url,
        method,
        headers,
        bodyString,
        config.insecureSkipVerify ?? false,
      );

      const rawBody = await res.text();

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
        this.logs.error(
          'input',
          'INPUT_FETCH_HTTP_ERROR',
          `Input test failed: ${input.name}`,
          error,
        );
        return { success: false, error };
      }

      let count: number | undefined;
      if (config.listEndpoint) {
        try {
          const data = JSON.parse(rawBody) as unknown;
          if (Array.isArray(data)) count = data.length;
        } catch {
          /* not JSON or not an array — that's fine */
        }
      }

      // Detect file extension for noArchive mode filename hint
      const detectedExtension = this.detectFileExtension(
        res.headers.get('content-disposition'),
        res.headers.get('content-type'),
        config.listEndpoint ? undefined : config.baseUrl,
      );

      await this.prisma.input.update({
        where: { id },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: 'ok',
          lastTestError: null,
          ...(detectedExtension
            ? {
                config: {
                  ...(input.config as object),
                  detectedExtension,
                },
              }
            : {}),
        },
      });
      return { success: true, count };
    } catch (err) {
      const isTyped = err instanceof OrbixException;
      const errorCode = isTyped ? err.code : undefined;
      const error = isTyped
        ? `[${err.code}] ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown error';
      await this.prisma.input.update({
        where: { id },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: 'error',
          lastTestError: error,
        },
      });
      if (err instanceof OrbixException) {
        this.logs.exception('input', err, `Input test failed: ${input.name}`);
      } else {
        this.logs.error(
          'input',
          'INPUT_FETCH_HTTP_ERROR',
          `Input test failed: ${input.name}`,
          error,
        );
      }
      return { success: false, error, errorCode };
    }
  }

  /**
   * Replace {{vault.var.<slug>.<key>}} tokens in a template string.
   * Mirrors the resolution logic used in the backup runner.
   */
  private async resolveTemplate(template: string): Promise<string> {
    const pattern = /\{\{vault\.var\.([^}]+)\}\}/g;
    const matches = [...template.matchAll(pattern)];
    if (matches.length === 0) return template;

    // Collect unique slugs and fetch their payloads once
    const slugs = [
      ...new Set(
        matches.map((m) => {
          const dot = m[1].indexOf('.');
          return dot >= 0 ? m[1].slice(0, dot) : m[1];
        }),
      ),
    ];

    const payloads = new Map<string, Record<string, string>>();
    for (const slug of slugs) {
      try {
        payloads.set(slug, await this.vault.getVariableSetPayloadBySlug(slug));
      } catch {
        payloads.set(slug, {});
      }
    }

    return template.replace(pattern, (_, ref: string) => {
      const dot = ref.indexOf('.');
      if (dot < 0) return '';
      const slug = ref.slice(0, dot);
      const key = ref.slice(dot + 1);
      return payloads.get(slug)?.[key] ?? '';
    });
  }

  /** Detect file extension from response metadata, best-effort. */
  private detectFileExtension(
    contentDisposition: string | null,
    contentType: string | null,
    fallbackUrl?: string,
  ): string {
    // 1. Content-Disposition: attachment; filename="portainer_backup.tar.gz"
    if (contentDisposition) {
      const cdMatch = contentDisposition.match(
        /filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i,
      );
      if (cdMatch) {
        try {
          const fname = decodeURIComponent(
            cdMatch[1].trim().replace(/["']/g, ''),
          );
          const ext = this.extractExt(fname);
          if (ext) return ext;
        } catch {
          /* decodeURIComponent failed */
        }
      }
    }

    // 2. Content-Type mapping
    const ct = (contentType ?? '').split(';')[0].trim().toLowerCase();
    const ctMap: Record<string, string> = {
      'application/zip': '.zip',
      'application/x-zip': '.zip',
      'application/x-zip-compressed': '.zip',
      'application/x-tar': '.tar',
      'application/gzip': '.tar.gz',
      'application/x-gzip': '.tar.gz',
      'application/x-bzip2': '.tar.bz2',
      'application/json': '.json',
      'text/csv': '.csv',
      'application/sql': '.sql',
    };
    if (ctMap[ct]) return ctMap[ct];

    // 3. URL path extension
    if (fallbackUrl) {
      try {
        const urlPath = new URL(fallbackUrl).pathname;
        const base = urlPath.split('/').pop() ?? '';
        const ext = this.extractExt(base);
        if (ext) return ext;
      } catch {
        /* invalid URL */
      }
    }

    return '';
  }

  /** Extract compound (.tar.gz) or simple (.json) extension from a filename. */
  private extractExt(filename: string): string {
    const compound = filename.match(/\.(tar\.gz|tar\.bz2|tar\.xz)$/i);
    if (compound) return '.' + compound[1].toLowerCase();
    const dot = filename.lastIndexOf('.');
    return dot > 0 ? filename.slice(dot).toLowerCase() : '';
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
