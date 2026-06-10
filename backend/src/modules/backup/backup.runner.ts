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
import { InputService } from '../input/input.service';
import { LogsWriter } from '../logs/logs.writer';
import { InputProviderRegistry } from '../../providers/input/input-provider.registry';
import { OutputProviderRegistry } from '../../providers/output/output-provider.registry';
import {
  parseBackupSources,
  type BackupSources,
  type BackupSource,
  type RequestParam,
} from './backup.types';
import type {
  FileToArchive,
  ArchiveResult,
  OutputRow,
} from '../../providers/providers.types';
import {
  OrbixException,
  InputProviderNotFoundException,
  OutputProviderNotFoundException,
  ArchiveSizeExceededException,
  ArchiveNoArchiveMultiFileException,
  ArchiveNoArchiveStreamException,
  UrlSourceHttpException,
  UrlSourceSizeExceededException,
  UrlSourceNoBodyException,
  VaultAuthUnsupportedTypeException,
  VaultOAuth2TokenFailedException,
  VaultOAuth2MissingTokenException,
} from '../../common/exceptions';

export interface ZipInfo {
  basic: boolean;
  encrypted: boolean;
  tarBz2: boolean;
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
      return 6;
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
    private readonly inputService: InputService,
    private readonly logs: LogsWriter,
    private readonly inputRegistry: InputProviderRegistry,
    private readonly outputRegistry: OutputProviderRegistry,
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
      const resolvedZipPassword = await this.resolveZipPassword(
        (backup as { zipPassword: string | null }).zipPassword,
        (backup as { zipPasswordVaultRef: string | null }).zipPasswordVaultRef,
      );
      const archive = await this.buildArchive(
        backup.name,
        sources,
        (backup as { archiveFormat: string }).archiveFormat ?? 'zip',
        (backup as { zipCompression: string }).zipCompression,
        resolvedZipPassword,
        (backup as { zipFilename: string | null }).zipFilename,
        maxSourceFileSizeMb,
        maxBackupTotalSizeMb,
        (backup as { noArchive: boolean }).noArchive ?? false,
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
      await this.prisma.backup.update({
        where: { id: backupId },
        data: { lastRunAt: new Date(), lastStatus: 'error' },
      });
      if (err instanceof OrbixException) {
        this.logs.exception('backup', err, `Backup failed: ${backup.name}`, {
          backupId,
        });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        this.logs.error(
          'backup',
          'BACKUP_RUN_ERROR',
          `Backup failed: ${backup.name}`,
          msg,
          { backupId },
        );
      }
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
      const resolvedZipPasswordV = await this.resolveZipPassword(
        (backup as { zipPassword: string | null }).zipPassword,
        (backup as { zipPasswordVaultRef: string | null }).zipPasswordVaultRef,
      );
      const archive = await this.buildArchive(
        backup.name,
        sources,
        (backup as { archiveFormat: string }).archiveFormat ?? 'zip',
        (backup as { zipCompression: string }).zipCompression,
        resolvedZipPasswordV,
        (backup as { zipFilename: string | null }).zipFilename,
        maxSourceFileSizeMb,
        maxBackupTotalSizeMb,
        (backup as { noArchive: boolean }).noArchive ?? false,
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
      const msg = err instanceof Error ? err.message : String(err);
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
      if (err instanceof OrbixException) {
        this.logs.exception(
          'backup',
          err,
          `Validation failed: ${backup.name}`,
          { backupId },
        );
      } else {
        this.logs.error(
          'backup',
          'BACKUP_VALIDATE_ERROR',
          `Validation failed: ${backup.name}`,
          msg,
          { backupId },
        );
      }
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
    noArchive = false,
  ): Promise<ArchiveResult> {
    const allFiles = await this.collectFiles(sources, maxSourceFileSizeMb);
    const now = new Date();
    const slug = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const ext = ARCHIVE_EXTENSIONS[archiveFormat] ?? '.zip';
    const level = compressionLevelOf(compression);

    const baseVars: Record<string, string> = {
      'backup.name': slug,
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

    if (noArchive) {
      if (allFiles.length !== 1) {
        throw new ArchiveNoArchiveMultiFileException(allFiles.length);
      }
      const f = allFiles[0];
      if (f.stream !== undefined) {
        throw new ArchiveNoArchiveStreamException();
      }

      const buffer = f.buffer !== undefined ? f.buffer : readFileSync(f.abs);
      if (buffer.byteLength > maxBackupTotalSizeMb * 1024 * 1024) {
        throw new ArchiveSizeExceededException(
          Math.round(buffer.byteLength / 1024 / 1024),
          maxBackupTotalSizeMb,
        );
      }

      const fileArc = f.arc.split('/').pop() ?? basename(f.arc);
      let noArchiveFilename: string;
      if (filenameTemplate) {
        const compoundMatch = fileArc.match(/\.(tar\.gz|tar\.bz2|tar\.xz)$/i);
        const detectedExt = compoundMatch
          ? '.' + compoundMatch[1].toLowerCase()
          : fileArc.includes('.')
            ? fileArc.slice(fileArc.lastIndexOf('.')).toLowerCase()
            : '';
        const base = resolveBase(filenameTemplate).replace(
          /\.(zip|tar\.gz|tar\.bz2|tar\.xz|tar)$/i,
          '',
        );
        noArchiveFilename = base + detectedExt;
      } else {
        noArchiveFilename = fileArc;
      }

      return {
        buffer,
        filename: noArchiveFilename,
        size: buffer.byteLength,
        filesCount: 1,
      };
    }

    if (
      allFiles.length === 1 &&
      !zipPassword &&
      archiveFormat === 'zip' &&
      compression === 'store' &&
      allFiles[0].stream === undefined
    ) {
      const f = allFiles[0];
      const buffer = f.buffer !== undefined ? f.buffer : readFileSync(f.abs);
      if (buffer.byteLength > maxBackupTotalSizeMb * 1024 * 1024) {
        throw new ArchiveSizeExceededException(
          Math.round(buffer.byteLength / 1024 / 1024),
          maxBackupTotalSizeMb,
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
      throw new ArchiveSizeExceededException(
        Math.round(buffer.byteLength / 1024 / 1024),
        maxBackupTotalSizeMb,
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
    const s = await this.settings.get();
    const resolved = isAbsolute(sourcePath)
      ? resolve(sourcePath)
      : resolve(s.filesRoot, sourcePath);

    // Prevent path traversal outside filesRoot for relative paths
    if (!isAbsolute(sourcePath)) {
      const root = resolve(s.filesRoot);
      if (!resolved.startsWith(root + sep) && resolved !== root) {
        throw new Error(
          `Path traversal detected: "${sourcePath}" escapes filesRoot`,
        );
      }
    }
    return resolved;
  }

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

    const toArcPath = (p: string): string => p.split(sep).join('/');

    for (const source of sources.sources) {
      if (source.type === 'url') {
        const raw = source.path.split('?')[0];
        const filename = raw.split('/').pop() ?? 'download';
        const fetched = await this.fetchUrlSource(source, maxSourceFileSizeMb);
        if (Buffer.isBuffer(fetched)) {
          results.push({ buffer: fetched, arc: filename });
        } else {
          results.push({ stream: fetched, arc: filename });
        }
        continue;
      }

      if (source.type === 'input') {
        if (!source.inputId) continue;
        const files = await this.fetchInputSource(
          source.inputId,
          maxSourceFileSizeMb,
        );
        results.push(...files);
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

  // ─── Source fetchers ─────────────────────────────────────────────────────────

  private async fetchUrlSource(
    source: BackupSource,
    maxSizeMb: number,
  ): Promise<Buffer | Readable> {
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
      throw new UrlSourceHttpException(source.path, response.status);
    }

    const maxBytes = maxSizeMb * 1024 * 1024;
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      if (!isNaN(bytes) && bytes > maxBytes) {
        throw new UrlSourceSizeExceededException(
          Math.round(bytes / 1024 / 1024),
          maxSizeMb,
          source.path,
        );
      }
    }

    if ((source.transferMode ?? 'stream') === 'stream') {
      if (!response.body) {
        throw new UrlSourceNoBodyException(source.path);
      }
      return Readable.fromWeb(
        response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
      );
    }

    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new UrlSourceSizeExceededException(
        Math.round(buf.byteLength / 1024 / 1024),
        maxSizeMb,
        source.path,
      );
    }
    return buf;
  }

  private async fetchInputSource(
    inputId: string,
    maxSizeMb: number,
  ): Promise<FileToArchive[]> {
    const input = await this.inputService.getOne(inputId);
    const provider = this.inputRegistry.get(input.type);
    if (!provider) {
      throw new InputProviderNotFoundException(input.type);
    }
    return provider.fetch(input, { maxSizeMb });
  }

  private async sendOutput(
    backupName: string,
    backupId: string,
    output: OutputRow,
    archive: ArchiveResult,
  ): Promise<void> {
    const provider = this.outputRegistry.get(output.type);
    if (!provider) {
      throw new OutputProviderNotFoundException(output.type);
    }
    await provider.send(output, archive, backupName, backupId);
  }

  // ─── Vault helpers (URL sources only) ───────────────────────────────────────

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
        const body = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: payload.clientId,
          client_secret: payload.clientSecret,
          ...(payload.scope ? { scope: payload.scope } : {}),
        });
        const res = await fetch(payload.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (!res.ok)
          throw new VaultOAuth2TokenFailedException(
            res.status,
            payload.tokenUrl,
          );
        const json = (await res.json()) as { access_token?: string };
        if (!json.access_token)
          throw new VaultOAuth2MissingTokenException(payload.tokenUrl);
        headers['Authorization'] = `Bearer ${json.access_token}`;
        break;
      }
      case 'oauth2_password_grant': {
        const pwBody = new URLSearchParams({
          grant_type: 'password',
          client_id: payload.clientId,
          username: payload.username,
          password: payload.password,
        });
        const pwRes = await fetch(payload.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: pwBody.toString(),
        });
        if (!pwRes.ok)
          throw new VaultOAuth2TokenFailedException(
            pwRes.status,
            payload.tokenUrl,
          );
        const pwJson = (await pwRes.json()) as { access_token?: string };
        if (!pwJson.access_token)
          throw new VaultOAuth2MissingTokenException(payload.tokenUrl);
        headers['Authorization'] = `Bearer ${pwJson.access_token}`;
        break;
      }
      case 'cookie':
        headers['Cookie'] = payload.value;
        break;
      case 'custom_kv':
        for (const { key, value } of payload.entries) headers[key] = value;
        break;
      default:
        throw new VaultAuthUnsupportedTypeException(payload.subtype);
    }
  }

  private async resolveParamValue(param: RequestParam): Promise<string> {
    if (param.valueType === 'literal') return param.value ?? '';
    if (!param.vaultId) return '';
    const payload = await this.vault.getHttpPayload(param.vaultId);
    const field = param.vaultField ?? '';
    const raw = (payload as unknown as Record<string, unknown>)[field];
    return typeof raw === 'string' ? raw : '';
  }

  private async resolveZipPassword(
    literal: string | null,
    vaultRef: string | null,
  ): Promise<string | null> {
    if (!vaultRef) return literal;
    const dotIdx = vaultRef.indexOf('.');
    if (dotIdx <= 0) return literal;
    const slug = vaultRef.slice(0, dotIdx);
    const key = vaultRef.slice(dotIdx + 1);
    try {
      const payload = await this.vault.getVariableSetPayloadBySlug(slug);
      return payload[key] ?? null;
    } catch {
      return null;
    }
  }

  // ─── Archive creation ────────────────────────────────────────────────────────

  private createArchive(
    files: FileToArchive[],
    format: string,
    level: number,
    password: string | null,
  ): Promise<Buffer> {
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
        return this.buildArchiverBuffer(
          archiver('tar', { gzip: true, gzipOptions: { level } }),
          files,
        );
      default:
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
      arc.on('error', (err) => {
        arc.destroy();
        reject(err);
      });
      for (const f of files) {
        if (f.stream !== undefined) {
          arc.append(f.stream, { name: f.arc });
        } else if (f.buffer !== undefined) {
          arc.append(f.buffer, { name: f.arc });
        } else {
          arc.file(f.abs, { name: f.arc });
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
          else if (f.buffer !== undefined)
            arc.append(f.buffer, { name: f.arc });
          else arc.file(f.abs, { name: f.arc });
        }
        void arc.finalize();
      } catch {
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
          else if (f.buffer !== undefined)
            arc.append(f.buffer, { name: f.arc });
          else arc.file(f.abs, { name: f.arc });
        }
        void arc.finalize();
      } catch {
        reject(new Error('archiver-tar-bzip2 not installed'));
      }
    });
  }
}
