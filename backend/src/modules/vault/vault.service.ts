import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';
import type { CreateEmailVaultDto } from './dto/create-email-vault.dto';
import type { UpdateEmailVaultDto } from './dto/update-email-vault.dto';
import type { CreateHttpVaultDto } from './dto/create-http-vault.dto';
import type { UpdateHttpVaultDto } from './dto/update-http-vault.dto';
import type {
  EmailPayload,
  EmailVaultResponse,
  HttpVaultPayload,
  HttpVaultResponse,
  HttpVaultSubtype,
  VaultRow,
} from './vault.types';
export type { EmailVaultResponse, HttpVaultResponse } from './vault.types';

@Injectable()
export class VaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly logs: LogsWriter,
  ) {}

  private getKey(): Buffer {
    const secret = this.config.getOrThrow<string>('VAULT_ENCRYPTION_KEY');
    return scryptSync(secret, 'orbix-vault', 32);
  }

  private encrypt(text: string): string {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(stored: string): string {
    const parts = stored.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted payload');
    const [ivHex, authTagHex, encHex] = parts;
    const key = this.getKey();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private toResponse(entity: VaultRow): EmailVaultResponse {
    const payload = JSON.parse(
      this.decrypt(entity.encryptedPayload),
    ) as EmailPayload;
    return {
      id: entity.id,
      name: entity.name,
      host: payload.host,
      port: payload.port,
      user: payload.user,
      fromAddr: payload.fromAddr,
      fromName: payload.fromName,
      secure: payload.secure,
      smtpStatus: entity.smtpStatus,
      smtpStatusMsg: entity.smtpStatusMsg,
      smtpCheckedAt: entity.smtpCheckedAt?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  async listEmail(
    cursor?: string,
    limit = 20,
  ): Promise<{ data: EmailVaultResponse[]; nextCursor: string | null }> {
    const take = Math.min(limit, 100);
    const items = await this.prisma.vaultEntity.findMany({
      where: { type: 'email' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { name: 'asc' },
    });
    const hasNext = items.length > take;
    const page = items.slice(0, take);
    return {
      data: page.map((e) => this.toResponse(e)),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async createEmail(dto: CreateEmailVaultDto): Promise<EmailVaultResponse> {
    const existing = await this.prisma.vaultEntity.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Name already in use');

    const payload: EmailPayload = {
      host: dto.host,
      port: dto.port,
      user: dto.user,
      password: dto.password,
      fromAddr: dto.fromAddr,
      fromName: dto.fromName ?? '',
      secure: dto.secure ?? false,
    };

    const entity = await this.prisma.vaultEntity.create({
      data: {
        name: dto.name,
        type: 'email',
        encryptedPayload: this.encrypt(JSON.stringify(payload)),
      },
    });
    this.logs.info(
      'vault',
      'VAULT_SMTP_CREATED',
      `SMTP config created: ${dto.name}`,
    );
    return this.toResponse(entity);
  }

  async getEmail(id: string): Promise<EmailVaultResponse> {
    const entity = await this.prisma.vaultEntity.findUnique({ where: { id } });
    if (!entity || entity.type !== 'email') throw new NotFoundException();
    return this.toResponse(entity);
  }

  async updateEmail(
    id: string,
    dto: UpdateEmailVaultDto,
  ): Promise<EmailVaultResponse> {
    const entity = await this.prisma.vaultEntity.findUnique({ where: { id } });
    if (!entity || entity.type !== 'email') throw new NotFoundException();

    if (dto.name && dto.name !== entity.name) {
      const conflict = await this.prisma.vaultEntity.findUnique({
        where: { name: dto.name },
      });
      if (conflict) throw new ConflictException('Name already in use');
    }

    const current = JSON.parse(
      this.decrypt(entity.encryptedPayload),
    ) as EmailPayload;

    const updated: EmailPayload = {
      host: dto.host ?? current.host,
      port: dto.port ?? current.port,
      user: dto.user ?? current.user,
      password: dto.password ?? current.password,
      fromAddr: dto.fromAddr ?? current.fromAddr,
      fromName: dto.fromName ?? current.fromName,
      secure: dto.secure ?? current.secure,
    };

    const result = await this.prisma.vaultEntity.update({
      where: { id },
      data: {
        name: dto.name ?? entity.name,
        encryptedPayload: this.encrypt(JSON.stringify(updated)),
      },
    });
    return this.toResponse(result);
  }

  countEmail(): Promise<number> {
    return this.prisma.vaultEntity.count({ where: { type: 'email' } });
  }

  async deleteEmail(id: string): Promise<void> {
    const entity = await this.prisma.vaultEntity.findUnique({ where: { id } });
    if (!entity || entity.type !== 'email') throw new NotFoundException();
    await this.prisma.vaultEntity.delete({ where: { id } });
    this.logs.info(
      'vault',
      'VAULT_SMTP_DELETED',
      `SMTP config deleted: ${entity.name}`,
    );
  }

  async getEmailPayload(id: string): Promise<EmailPayload> {
    const entity = await this.prisma.vaultEntity.findUnique({ where: { id } });
    if (!entity || entity.type !== 'email') throw new NotFoundException();
    return JSON.parse(this.decrypt(entity.encryptedPayload)) as EmailPayload;
  }

  async checkAllEmail(): Promise<void> {
    const entities = await this.prisma.vaultEntity.findMany({
      where: { type: 'email' },
    });
    await Promise.allSettled(
      entities.map((e) => this.testEmail(e.id).catch(() => {})),
    );
  }

  // ─── HTTP vault ──────────────────────────────────────────────────────────────

  private buildHttpPayload(
    subtype: HttpVaultSubtype,
    data: Record<string, unknown>,
  ): HttpVaultPayload {
    const req = (k: string): string => {
      const v = data[k];
      if (typeof v !== 'string' || !v)
        throw new BadRequestException(
          `Field '${k}' is required for subtype '${subtype}'`,
        );
      return v;
    };
    const opt = (k: string): string | undefined => {
      const v = data[k];
      return typeof v === 'string' && v ? v : undefined;
    };

    switch (subtype) {
      case 'token':
        return { subtype, token: req('token') };
      case 'username_password':
        return {
          subtype,
          username: req('username'),
          password: req('password'),
        };
      case 'key_secret':
        return { subtype, key: req('key'), secret: req('secret') };
      case 'oauth2_client_credentials':
        return {
          subtype,
          clientId: req('clientId'),
          clientSecret: req('clientSecret'),
          tokenUrl: req('tokenUrl'),
          scope: opt('scope'),
        };
      case 'oauth2_password_grant':
        return {
          subtype,
          username: req('username'),
          password: req('password'),
          clientId: req('clientId'),
          tokenUrl: req('tokenUrl'),
        };
      case 'mtls_certificate':
        return {
          subtype,
          cert: req('cert'),
          key: req('key'),
          passphrase: opt('passphrase'),
        };
      case 'ssh_key':
        return {
          subtype,
          privateKey: req('privateKey'),
          passphrase: opt('passphrase'),
        };
      case 'jwt_signing_key':
        return {
          subtype,
          privateKey: req('privateKey'),
          algorithm: req('algorithm'),
          issuer: opt('issuer'),
          audience: opt('audience'),
          expiresIn: opt('expiresIn'),
        };
      case 'aws_sigv4':
        return {
          subtype,
          accessKeyId: req('accessKeyId'),
          secretAccessKey: req('secretAccessKey'),
          region: req('region'),
          service: req('service'),
        };
      case 'cookie':
        return { subtype, value: req('value') };
      case 'custom_kv':
        return {
          subtype,
          entries:
            (data['entries'] as Array<{ key: string; value: string }>) ?? [],
        };
      default:
        throw new BadRequestException(
          `Unknown HTTP vault subtype: ${subtype as string}`,
        );
    }
  }

  private httpToResponse(entity: VaultRow): HttpVaultResponse {
    const payload = JSON.parse(
      this.decrypt(entity.encryptedPayload),
    ) as HttpVaultPayload;
    return {
      id: entity.id,
      name: entity.name,
      subtype: payload.subtype,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  async listHttp(
    cursor?: string,
    limit = 20,
  ): Promise<{ data: HttpVaultResponse[]; nextCursor: string | null }> {
    const take = Math.min(limit, 100);
    const items = await this.prisma.vaultEntity.findMany({
      where: { type: 'http' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { name: 'asc' },
    });
    const hasNext = items.length > take;
    const page = items.slice(0, take);
    return {
      data: page.map((e) => this.httpToResponse(e)),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async createHttp(dto: CreateHttpVaultDto): Promise<HttpVaultResponse> {
    const existing = await this.prisma.vaultEntity.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Name already in use');

    const payload = this.buildHttpPayload(dto.subtype, dto.data);
    const entity = await this.prisma.vaultEntity.create({
      data: {
        name: dto.name,
        type: 'http',
        encryptedPayload: this.encrypt(JSON.stringify(payload)),
      },
    });
    this.logs.info(
      'vault',
      'VAULT_HTTP_CREATED',
      `HTTP credential created: ${dto.name}`,
    );
    return this.httpToResponse(entity);
  }

  async getHttp(id: string): Promise<HttpVaultResponse> {
    const entity = await this.prisma.vaultEntity.findUnique({ where: { id } });
    if (!entity || entity.type !== 'http') throw new NotFoundException();
    return this.httpToResponse(entity);
  }

  async updateHttp(
    id: string,
    dto: UpdateHttpVaultDto,
  ): Promise<HttpVaultResponse> {
    const entity = await this.prisma.vaultEntity.findUnique({ where: { id } });
    if (!entity || entity.type !== 'http') throw new NotFoundException();

    if (dto.name && dto.name !== entity.name) {
      const conflict = await this.prisma.vaultEntity.findUnique({
        where: { name: dto.name },
      });
      if (conflict) throw new ConflictException('Name already in use');
    }

    const current = JSON.parse(
      this.decrypt(entity.encryptedPayload),
    ) as HttpVaultPayload;
    let payload: HttpVaultPayload;
    if (dto.data && Object.keys(dto.data).length > 0) {
      const merged: Record<string, unknown> = { ...current };
      for (const [k, v] of Object.entries(dto.data)) {
        if (v !== undefined && v !== '') merged[k] = v;
      }
      payload = merged as unknown as HttpVaultPayload;
    } else {
      payload = current;
    }

    const result = await this.prisma.vaultEntity.update({
      where: { id },
      data: {
        name: dto.name ?? entity.name,
        encryptedPayload: this.encrypt(JSON.stringify(payload)),
      },
    });
    return this.httpToResponse(result);
  }

  countHttp(): Promise<number> {
    return this.prisma.vaultEntity.count({ where: { type: 'http' } });
  }

  async deleteHttp(id: string): Promise<void> {
    const entity = await this.prisma.vaultEntity.findUnique({ where: { id } });
    if (!entity || entity.type !== 'http') throw new NotFoundException();
    await this.prisma.vaultEntity.delete({ where: { id } });
    this.logs.info(
      'vault',
      'VAULT_HTTP_DELETED',
      `HTTP credential deleted: ${entity.name}`,
    );
  }

  async getHttpPayload(id: string): Promise<HttpVaultPayload> {
    const entity = await this.prisma.vaultEntity.findUnique({ where: { id } });
    if (!entity || entity.type !== 'http') throw new NotFoundException();
    return JSON.parse(
      this.decrypt(entity.encryptedPayload),
    ) as HttpVaultPayload;
  }

  // ─── Email vault ─────────────────────────────────────────────────────────────

  async testEmail(id: string): Promise<void> {
    const entity = await this.prisma.vaultEntity.findUnique({ where: { id } });
    if (!entity || entity.type !== 'email') throw new NotFoundException();

    const payload = JSON.parse(
      this.decrypt(entity.encryptedPayload),
    ) as EmailPayload;

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: payload.host,
      port: payload.port,
      secure: payload.secure,
      auth: { user: payload.user, pass: payload.password },
      connectionTimeout: 8000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
    });

    try {
      await transporter.verify();
      await this.prisma.vaultEntity.update({
        where: { id },
        data: {
          smtpStatus: 'ok',
          smtpStatusMsg: null,
          smtpCheckedAt: new Date(),
        },
      });
      this.logs.info(
        'vault',
        'VAULT_SMTP_TEST_OK',
        `SMTP test OK: ${entity.name}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SMTP connection failed';
      await this.prisma.vaultEntity.update({
        where: { id },
        data: {
          smtpStatus: 'error',
          smtpStatusMsg: msg,
          smtpCheckedAt: new Date(),
        },
      });
      this.logs.warn(
        'vault',
        'VAULT_SMTP_TEST_FAIL',
        `SMTP test failed: ${entity.name}`,
        msg,
      );
      throw new HttpException(
        { error: { code: 'SMTP_ERROR', message: msg } },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
