import { Injectable } from '@nestjs/common';
import { statSync, existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import {
  join,
  basename,
  resolve,
  relative,
  dirname,
  isAbsolute,
  sep,
} from 'node:path';
import archiver, { type Archiver } from 'archiver';
import { PrismaService } from '../../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import { SettingsService } from '../settings/settings.service';
import { LogsWriter } from '../logs/logs.writer';
import {
  parseBackupSources,
  type BackupSources,
  type BackupSource,
  type RequestParam,
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

interface ArchiveResult {
  buffer: Buffer;
  filename: string;
  size: number;
  filesCount: number;
}

type FileToArchive =
  | { abs: string; arc: string; buffer?: never; stream?: never }
  | { buffer: Buffer; arc: string; abs?: never; stream?: never }
  | { stream: NodeJS.ReadableStream; arc: string; abs?: never; buffer?: never };

export interface ZipInfo {
  basic: boolean; // zip + tar + tar-gz always available
  encrypted: boolean; // archiver-zip-encrypted
  tarBz2: boolean; // archiver-tar-bzip2
  platform: string;
  node: string;
}

const ARCHIVE_EXTENSIONS: Record<string, string> = {
  zip: '.zip',
  tar: '.tar',
  'tar-gz': '.tar.gz',
  'tar-bz2': '.tar.bz2',
};

function compressionLevelOf(c: string): number {
  switch (c) {
    case 'store':
      return 0;
    case 'fast':
      return 1;
    case 'best':
      return 9;
    default:
      return 6; // 'default'
  }
}

@Injectable()
export class BackupRunner {
  private static encryptedFormatRegistered = false;
  private static bzip2FormatRegistered = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly settings: SettingsService,
    private readonly logs: LogsWriter,
  ) {}

  async run(backupId: string): Promise<void> {
    const backup = await this.prisma.backup.findUnique({
      where: { id: backupId },
      include: { outputs: true },
    });
    if (!backup) {
      this.logs.error(
        'backup',
        'BACKUP_RUN_NOT_FOUND',
        `Backup ${backupId} not found`,
        undefined,
        { backupId },
      );
      return;
    }

    this.logs.info(
      'backup',
      'BACKUP_RUN_START',
      `Backup run started: ${backup.name}`,
      undefined,
      { backupId },
    );

    try {
      const settings = await this.settings.get();
      const settingsAny = settings as Record<string, unknown>;
      const maxSourceFileSizeMb =
        typeof settingsAny['maxSourceFileSizeMb'] === 'number'
          ? settingsAny['maxSourceFileSizeMb']
          : 500;
      const maxBackupTotalSizeMb =
        typeof settingsAny['maxBackupTotalSizeMb'] === 'number'
          ? settingsAny['maxBackupTotalSizeMb']
          : 2000;

      const sources = parseBackupSources(backup.sources);
      const archive = await this.buildArchive(
        backup.name,
        sources,
        (backup as { archiveFormat: string }).archiveFormat ?? 'zip',
        (backup as { zipCompression: string }).zipCompression,
        (backup as { zipPassword: string | null }).zipPassword,
        (backup as { zipFilename: string | null }).zipFilename,
        maxSourceFileSizeMb,
        maxBackupTotalSizeMb,
      );

      for (const output of (backup.outputs as OutputRow[]).sort(
        (a, b) => a.order - b.order,
      )) {
        await this.sendOutput(backup.name, backupId, output, archive);
      }

      await this.prisma.backup.update({
        where: { id: backupId },
        data: { lastRunAt: new Date(), lastStatus: 'success' },
      });

      // One-shot: auto-disable after running
      if ((backup as { scheduleType: string }).scheduleType === 'oneshoot') {
        await this.prisma.backup.update({
          where: { id: backupId },
          data: { enabled: false },
        });
      }

      this.logs.info(
        'backup',
        'BACKUP_RUN_SUCCESS',
        `Backup completed: ${backup.name}`,
        undefined,
        { backupId },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await this.prisma.backup.update({
        where: { id: backupId },
        data: { lastRunAt: new Date(), lastStatus: 'error' },
      });
      this.logs.error(
        'backup',
        'BACKUP_RUN_ERROR',
        `Backup failed: ${backup.name}`,
        msg,
        { backupId },
      );
      throw err;
    }
  }

  async runValidation(backupId: string): Promise<void> {
    const backup = await this.prisma.backup.findUnique({
      where: { id: backupId },
      include: { outputs: true },
    });
    if (!backup) {
      this.logs.error(
        'backup',
        'BACKUP_VALIDATE_NOT_FOUND',
        `Backup ${backupId} not found`,
        undefined,
        { backupId },
      );
      return;
    }

    this.logs.info(
      'backup',
      'BACKUP_VALIDATE_START',
      `Validation started: ${backup.name}`,
      undefined,
      { backupId },
    );

    try {
      const settings = await this.settings.get();
      const settingsAny = settings as Record<string, unknown>;
      const maxSourceFileSizeMb =
        typeof settingsAny['maxSourceFileSizeMb'] === 'number'
          ? settingsAny['maxSourceFileSizeMb']
          : 500;
      const maxBackupTotalSizeMb =
        typeof settingsAny['maxBackupTotalSizeMb'] === 'number'
          ? settingsAny['maxBackupTotalSizeMb']
          : 2000;

      const sources = parseBackupSources(backup.sources);
      const archive = await this.buildArchive(
        backup.name,
        sources,
        (backup as { archiveFormat: string }).archiveFormat ?? 'zip',
        (backup as { zipCompression: string }).zipCompression,
        (backup as { zipPassword: string | null }).zipPassword,
        (backup as { zipFilename: string | null }).zipFilename,
        maxSourceFileSizeMb,
        maxBackupTotalSizeMb,
      );

      for (const output of (backup.outputs as OutputRow[]).sort(
        (a, b) => a.order - b.order,
      )) {
        await this.sendOutput(backup.name, backupId, output, archive);
      }

      await this.prisma.backup.update({
        where: { id: backupId },
        data: {
          validationStatus: 'success',
          isValidated: true,
          validatedAt: new Date(),
          validationError: null,
          lastRunAt: new Date(),
          lastStatus: 'success',
        },
      });
      this.logs.info(
        'backup',
        'BACKUP_VALIDATE_SUCCESS',
        `Validation passed: ${backup.name}`,
        undefined,
        { backupId },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await this.prisma.backup.update({
        where: { id: backupId },
        data: {
          validationStatus: 'error',
          validationError: msg,
          isValidated: false,
          lastRunAt: new Date(),
          lastStatus: 'error',
        },
      });
      this.logs.error(
        'backup',
        'BACKUP_VALIDATE_ERROR',
        `Validation failed: ${backup.name}`,
        msg,
        { backupId },
      );
    }
  }

  // ─── Zip capabilities ───────────────────────────────────────────────────────

  getZipInfo(): ZipInfo {
    return {
      basic: true,
      encrypted: this.isEncryptedAvailable(),
      tarBz2: this.isBzip2Available(),
      platform: process.platform,
      node: process.version,
    };
  }

  async testZip(): Promise<{
    success: boolean;
    durationMs: number;
    sizeBytes: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const buffer = await this.createTestZip();
      return {
        success: true,
        durationMs: Date.now() - start,
        sizeBytes: buffer.byteLength,
      };
    } catch (err) {
      return {
        success: false,
        durationMs: Date.now() - start,
        sizeBytes: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private isEncryptedAvailable(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('archiver-zip-encrypted');
      return true;
    } catch {
      return false;
    }
  }

  private isBzip2Available(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('archiver-tar-bzip2');
      return true;
    } catch {
      return false;
    }
  }

  private createTestZip(): Promise<Buffer> {
    return new Promise((res, rej) => {
      const chunks: Buffer[] = [];
      const arc = archiver('zip', { zlib: { level: 6 } });
      arc.on('data', (c: Buffer) => chunks.push(c));
      arc.on('end', () => res(Buffer.concat(chunks)));
      arc.on('error', rej);
      arc.append(Buffer.from(`Orbix zip test ${new Date().toISOString()}`), {
        name: 'test.txt',
      });
      void arc.finalize();
    });
  }

  // ─── Archive building ────────────────────────────────────────────────────────

  private async buildArchive(
    name: string,
    sources: BackupSources,
    archiveFormat: string,
    compression: string,
    zipPassword: string | null,
    filenameTemplate: string | null,
    maxSourceFileSizeMb: number,
    maxBackupTotalSizeMb: number,
  ): Promise<ArchiveResult> {
    const allFiles = await this.collectFiles(sources, maxSourceFileSizeMb);
    const now = new Date();
    const slug = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const ext = ARCHIVE_EXTENSIONS[archiveFormat] ?? '.zip';
    const level = compressionLevelOf(compression);

    const baseVars: Record<string, string> = {
      'backup.name': name,
      date: now.toISOString().slice(0, 10),
      datetime: now
        .toISOString()
        .slice(0, 16)
        .replace('T', '_')
        .replace(/:/g, '-'),
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      day: String(now.getDate()).padStart(2, '0'),
    };

    const resolveBase = (tpl: string): string =>
      tpl.replace(
        /\{\{([^}]+)\}\}/g,
        (_, key: string) => baseVars[key] ?? `{{${key}}}`,
      );

    // Filename: resolve template (base name), append correct extension
    const base = filenameTemplate
      ? resolveBase(filenameTemplate).replace(
          /\.(zip|tar\.gz|tar\.bz2|tar)$/i,
          '',
        )
      : `${slug}_${now.toISOString().slice(0, 10)}`;
    const filename = base + ext;

    if (allFiles.length === 0) {
      return { buffer: Buffer.alloc(0), filename, size: 0, filesCount: 0 };
    }

    // Single file with no password and non-compressed format → send raw (buffer/file only, not stream)
    if (
      allFiles.length === 1 &&
      !zipPassword &&
      archiveFormat === 'zip' &&
      compression === 'store' &&
      allFiles[0].stream === undefined
    ) {
      const f = allFiles[0];
      const buffer = f.buffer !== undefined ? f.buffer : readFileSync(f.abs!);
      if (buffer.byteLength > maxBackupTotalSizeMb * 1024 * 1024) {
        throw new Error(
          `Archive size (${Math.round(buffer.byteLength / 1024 / 1024)} MB) exceeds the configured limit of ${maxBackupTotalSizeMb} MB`,
        );
      }
      return {
        buffer,
        filename: f.arc.split('/').pop() ?? basename(f.arc),
        size: buffer.byteLength,
        filesCount: 1,
      };
    }

    const buffer = await this.createArchive(
      allFiles,
      archiveFormat,
      level,
      zipPassword,
    );

    if (buffer.byteLength > maxBackupTotalSizeMb * 1024 * 1024) {
      throw new Error(
        `Archive size (${Math.round(buffer.byteLength / 1024 / 1024)} MB) exceeds the configured limit of ${maxBackupTotalSizeMb} MB`,
      );
    }

    return {
      buffer,
      filename,
      size: buffer.byteLength,
      filesCount: allFiles.length,
    };
  }

  private async resolveSourcePath(sourcePath: string): Promise<string> {
    if (isAbsolute(sourcePath)) return sourcePath;
    const s = await this.settings.get();
    return resolve(s.filesRoot, sourcePath);
  }

  /** Collect all files with their archive paths, preserving folder structure. */
  private async collectFiles(
    sources: BackupSources,
    maxSourceFileSizeMb: number,
  ): Promise<FileToArchive[]> {
    const results: FileToArchive[] = [];

    const matchesPatterns = (filePath: string, patterns: string[]): boolean => {
      if (patterns.length === 0) return false;
      const name = basename(filePath);
      return patterns.some((pattern) => {
        if (pattern.startsWith('*.')) return name.endsWith(pattern.slice(1));
        return name === pattern || filePath.includes(pattern);
      });
    };

    // Cross-platform: normalize OS path separators to forward slashes for zip
    const toArcPath = (p: string): string => p.split(sep).join('/');

    for (const source of sources.sources) {
      if (source.type === 'url') {
        const raw = source.path.split('?')[0];
        const filename = raw.split('/').pop() ?? 'download';
        const fetched = await this.fetchUrlSource(source, maxSourceFileSizeMb);
        if (fetched instanceof Buffer) {
          results.push({ buffer: fetched, arc: filename });
        } else {
          results.push({ stream: fetched, arc: filename });
        }
        continue;
      }

      const absPath = await this.resolveSourcePath(source.path);
      const excludePatterns = source.exclude ?? [];

      if (source.type === 'file') {
        if (existsSync(absPath) && !matchesPatterns(absPath, excludePatterns)) {
          results.push({ abs: absPath, arc: basename(absPath) });
        }
        continue;
      }

      // Folder: preserve structure relative to the folder's PARENT
      // e.g., source = /data/files/toto, file = /data/files/toto/sub/f.txt
      //       arc = toto/sub/f.txt
      const sourceParent = dirname(absPath);

      const walk = async (p: string) => {
        if (!existsSync(p) || matchesPatterns(p, excludePatterns)) return;
        let stat: ReturnType<typeof statSync>;
        try {
          stat = statSync(p);
        } catch {
          return;
        }
        if (stat.isDirectory()) {
          const entries = await readdir(p);
          for (const entry of entries) await walk(join(p, entry));
        } else {
          const arcPath = toArcPath(relative(sourceParent, p));
          results.push({ abs: p, arc: arcPath });
        }
      };

      await walk(absPath);
    }

    return results;
  }

  // ─── URL source helpers ──────────────────────────────────────────────────────

  private async fetchUrlSource(
    source: BackupSource,
    maxSizeMb: number,
  ): Promise<Buffer | NodeJS.ReadableStream> {
    const headers: Record<string, string> = {};
    const url = new URL(source.path);

    if (source.vaultId) {
      await this.applyVaultAuth(headers, source.vaultId);
    }

    if (source.requestParams) {
      for (const param of source.requestParams) {
        const value = await this.resolveParamValue(param);
        if (param.in === 'header') headers[param.key] = value;
        else if (param.in === 'query') url.searchParams.set(param.key, value);
      }
    }

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(
        `URL source returned HTTP ${response.status}: ${source.path}`,
      );
    }

    const maxBytes = maxSizeMb * 1024 * 1024;
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      if (!isNaN(bytes) && bytes > maxBytes) {
        throw new Error(
          `Source file size (${Math.round(bytes / 1024 / 1024)} MB) exceeds the configured limit of ${maxSizeMb} MB: ${source.path}`,
        );
      }
    }

    // stream is the default: pipe response body directly to archiver without buffering
    if ((source.transferMode ?? 'stream') === 'stream') {
      if (!response.body) {
        throw new Error(`URL source returned no body: ${source.path}`);
      }
      return Readable.fromWeb(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        response.body as any,
      );
    }

    // buffer mode: load entirely in RAM
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new Error(
        `Source file size (${Math.round(buf.byteLength / 1024 / 1024)} MB) exceeds the configured limit of ${maxSizeMb} MB: ${source.path}`,
      );
    }
    return buf;
  }

  private async applyVaultAuth(
    headers: Record<string, string>,
    vaultId: string,
  ): Promise<void> {
    const payload = await this.vault.getHttpPayload(vaultId);
    switch (payload.subtype) {
      case 'token':
        headers['Authorization'] = `Bearer ${payload.token}`;
        break;
      case 'username_password':
        headers['Authorization'] =
          `Basic ${Buffer.from(`${payload.username}:${payload.password}`).toString('base64')}`;
        break;
      case 'key_secret':
        headers[payload.key] = payload.secret;
        break;
      case 'oauth2_client_credentials': {
        const token = await this.fetchOAuth2ClientToken(
          payload.tokenUrl,
          payload.clientId,
          payload.clientSecret,
          payload.scope,
        );
        headers['Authorization'] = `Bearer ${token}`;
        break;
      }
      case 'oauth2_password_grant': {
        const token = await this.fetchOAuth2PasswordToken(
          payload.tokenUrl,
          payload.clientId,
          payload.username,
          payload.password,
        );
        headers['Authorization'] = `Bearer ${token}`;
        break;
      }
      case 'cookie':
        headers['Cookie'] = payload.value;
        break;
      case 'custom_kv':
        for (const { key, value } of payload.entries) headers[key] = value;
        break;
      default:
        // mtls_certificate, ssh_key, jwt_signing_key, aws_sigv4 — not yet supported in runner
        throw new Error(
          `HTTP auth type '${payload.subtype}' is not supported in the backup runner`,
        );
    }
  }

  private async fetchOAuth2ClientToken(
    tokenUrl: string,
    clientId: string,
    clientSecret: string,
    scope?: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      ...(scope ? { scope } : {}),
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`OAuth2 token request failed: ${res.status}`);
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token)
      throw new Error('OAuth2 response missing access_token');
    return json.access_token;
  }

  private async fetchOAuth2PasswordToken(
    tokenUrl: string,
    clientId: string,
    username: string,
    password: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      username,
      password,
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok)
      throw new Error(
        `OAuth2 password grant token request failed: ${res.status}`,
      );
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token)
      throw new Error('OAuth2 response missing access_token');
    return json.access_token;
  }

  private async resolveParamValue(param: RequestParam): Promise<string> {
    if (param.valueType === 'literal') return param.value ?? '';
    if (!param.vaultId) return '';
    const payload = await this.vault.getHttpPayload(param.vaultId);
    const field = param.vaultField ?? '';

    const raw = (payload as unknown as Record<string, unknown>)[field];
    return typeof raw === 'string' ? raw : '';
  }

  // ─── Archive building ────────────────────────────────────────────────────────

  private createArchive(
    files: FileToArchive[],
    format: string,
    level: number,
    password: string | null,
  ): Promise<Buffer> {
    // Encrypted ZIP (password only supported for zip format)
    if (format === 'zip' && password && this.isEncryptedAvailable()) {
      return this.createEncryptedZip(files, level, password);
    }

    switch (format) {
      case 'tar':
        return this.buildArchiverBuffer(archiver('tar'), files);
      case 'tar-gz':
        return this.buildArchiverBuffer(
          archiver('tar', { gzip: true, gzipOptions: { level } }),
          files,
        );
      case 'tar-bz2':
        if (this.isBzip2Available()) {
          return this.createTarBz2(files, level);
        }
        // Fallback to tar-gz if bzip2 unavailable
        return this.buildArchiverBuffer(
          archiver('tar', { gzip: true, gzipOptions: { level } }),
          files,
        );
      default: // zip
        return this.buildArchiverBuffer(
          archiver('zip', { zlib: { level } }),
          files,
        );
    }
  }

  private buildArchiverBuffer(
    arc: Archiver,
    files: FileToArchive[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      arc.on('data', (chunk: Buffer) => chunks.push(chunk));
      arc.on('end', () => resolve(Buffer.concat(chunks)));
      arc.on('error', reject);
      for (const f of files) {
        if (f.stream !== undefined) {
          arc.append(f.stream, { name: f.arc });
        } else if (f.buffer !== undefined) {
          arc.append(f.buffer, { name: f.arc });
        } else {
          arc.file(f.abs!, { name: f.arc });
        }
      }
      void arc.finalize();
    });
  }

  private createEncryptedZip(
    files: FileToArchive[],
    level: number,
    password: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
        const plugin = require('archiver-zip-encrypted');
        if (!BackupRunner.encryptedFormatRegistered) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          (archiver as any).registerFormat('zip-encrypted', plugin);
          BackupRunner.encryptedFormatRegistered = true;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const arc = (archiver as any).create('zip-encrypted', {
          zlib: { level },
          encryptionMethod: 'aes256',
          password,
        }) as Archiver;
        arc.on('data', (chunk: Buffer) => chunks.push(chunk));
        arc.on('end', () => resolve(Buffer.concat(chunks)));
        arc.on('error', reject);
        for (const f of files) {
          if (f.stream !== undefined) arc.append(f.stream, { name: f.arc });
          else if (f.buffer !== undefined) arc.append(f.buffer, { name: f.arc });
          else arc.file(f.abs!, { name: f.arc });
        }
        void arc.finalize();
      } catch {
        // Fallback to standard zip if plugin fails at runtime
        resolve(
          this.buildArchiverBuffer(archiver('zip', { zlib: { level } }), files),
        );
      }
    });
  }

  private createTarBz2(files: FileToArchive[], level: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
        const plugin = require('archiver-tar-bzip2');
        if (!BackupRunner.bzip2FormatRegistered) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          (archiver as any).registerFormat('tar-bz2', plugin);
          BackupRunner.bzip2FormatRegistered = true;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const arc = (archiver as any).create('tar-bz2', {
          bzip2Options: { level },
        }) as Archiver;
        arc.on('data', (chunk: Buffer) => chunks.push(chunk));
        arc.on('end', () => resolve(Buffer.concat(chunks)));
        arc.on('error', reject);
        for (const f of files) {
          if (f.stream !== undefined) arc.append(f.stream, { name: f.arc });
          else if (f.buffer !== undefined) arc.append(f.buffer, { name: f.arc });
          else arc.file(f.abs!, { name: f.arc });
        }
        void arc.finalize();
      } catch {
        reject(new Error('archiver-tar-bzip2 not installed'));
      }
    });
  }

  private async sendOutput(
    backupName: string,
    backupId: string,
    output: OutputRow,
    archive: ArchiveResult,
  ): Promise<void> {
    if (output.type !== 'mail') return;

    const smtpPayload = await this.vault.getEmailPayload(output.vaultId);
    const toContacts = await this.resolveContacts(output.recipientsTo);
    const ccContacts = await this.resolveContacts(output.recipientsCc);
    const bccContacts = await this.resolveContacts(output.recipientsBcc);

    let subject = '{{backup.name}} backup completed';
    let body = 'Backup {{backup.name}} completed successfully.';
    let bodyType: 'text' | 'html' = 'text';

    if (output.templateId) {
      const template = await this.prisma.mailTemplate.findUnique({
        where: { id: output.templateId },
      });
      if (template) {
        subject = template.subject;
        body = template.body;
        bodyType = template.bodyType as 'text' | 'html';
      }
    }

    if (output.overrideSubject) subject = output.overrideSubject;
    if (output.overrideBody) body = output.overrideBody;
    if (output.overrideBodyType)
      bodyType = output.overrideBodyType as 'text' | 'html';

    const now = new Date();
    const baseVars: Record<string, string> = {
      'backup.name': backupName,
      'backup.size': this.formatSize(archive.size),
      'backup.archive': archive.filename,
      'backup.files_count': String(archive.filesCount),
      date: now.toLocaleDateString('en-US'),
      time: now.toLocaleTimeString('en-US'),
      datetime: now.toLocaleString('en-US'),
    };

    const resolveVars = (tpl: string, extra: Record<string, string>): string =>
      tpl.replace(
        /\{\{([^}]+)\}\}/g,
        (_, key: string) => extra[key] ?? baseVars[key] ?? `{{${key}}}`,
      );

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpPayload.host,
      port: smtpPayload.port,
      secure: smtpPayload.secure,
      auth: { user: smtpPayload.user, pass: smtpPayload.password },
    });

    const from = smtpPayload.fromName
      ? `"${smtpPayload.fromName}" <${smtpPayload.fromAddr}>`
      : smtpPayload.fromAddr;

    const attachments =
      archive.size > 0
        ? [{ filename: archive.filename, content: archive.buffer }]
        : [];

    const recipients =
      toContacts.length > 0 ? toContacts : [{ name: '', email: '' }];
    const ccEmails = ccContacts.map((c) => c.email);
    const bccEmails = bccContacts.map((c) => c.email);

    for (const contact of recipients) {
      const contactVars = {
        'recipient.name': contact.name,
        'recipient.email': contact.email,
      };
      const resolvedSubject = resolveVars(subject, contactVars);
      const resolvedBody = resolveVars(body, contactVars);

      try {
        await transporter.sendMail({
          from,
          to: contact.email || undefined,
          cc: ccEmails.length > 0 ? ccEmails.join(', ') : undefined,
          bcc: bccEmails.length > 0 ? bccEmails.join(', ') : undefined,
          subject: resolvedSubject,
          ...(bodyType === 'html'
            ? { html: resolvedBody }
            : { text: resolvedBody }),
          attachments,
        });
        await this.prisma.mailLog.create({
          data: {
            vaultId: output.vaultId,
            toAddrs: contact.email ? [contact.email] : [],
            subject: resolvedSubject,
            status: 'sent',
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Send failed';
        await this.prisma.mailLog.create({
          data: {
            vaultId: output.vaultId,
            toAddrs: contact.email ? [contact.email] : [],
            subject: resolvedSubject,
            status: 'error',
            errorMsg: msg,
          },
        });
        this.logs.error(
          'backup',
          'BACKUP_MAIL_ERROR',
          `Mail send failed for backup ${backupName}`,
          msg,
          { backupId },
        );
      }
    }
  }

  private async resolveContacts(
    ids: string[],
  ): Promise<{ name: string; email: string }[]> {
    if (ids.length === 0) return [];
    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    return ids
      .map((id) => contacts.find((c) => c.id === id))
      .filter(
        (c): c is { id: string; name: string; email: string } => c != null,
      );
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }
}
