import { Injectable } from '@nestjs/common';
import { statSync, existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import archiver from 'archiver';
import { PrismaService } from '../../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import { LogsWriter } from '../logs/logs.writer';
import type { BackupSources } from './backup.types';
import type { BackupOutput } from '../../generated/prisma';

interface ArchiveResult {
  buffer: Buffer;
  filename: string;
  size: number;
  filesCount: number;
}

@Injectable()
export class BackupRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly logs: LogsWriter,
  ) {}

  async run(backupId: string): Promise<void> {
    const backup = await this.prisma.backup.findUnique({
      where: { id: backupId },
      include: { outputs: true },
    });
    if (!backup) {
      this.logs.error('backup', 'BACKUP_RUN_NOT_FOUND', `Backup ${backupId} not found`);
      return;
    }

    this.logs.info('backup', 'BACKUP_RUN_START', `Backup run started: ${backup.name}`);

    try {
      const sources = backup.sources as BackupSources;
      const archive = await this.buildArchive(backup.name, sources, backup.compression);

      for (const output of backup.outputs) {
        await this.sendOutput(backup.name, output, archive);
      }

      await this.prisma.backup.update({
        where: { id: backupId },
        data: { lastRunAt: new Date(), lastStatus: 'success' },
      });
      this.logs.info('backup', 'BACKUP_RUN_SUCCESS', `Backup completed: ${backup.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await this.prisma.backup.update({
        where: { id: backupId },
        data: { lastRunAt: new Date(), lastStatus: 'error' },
      });
      this.logs.error('backup', 'BACKUP_RUN_ERROR', `Backup failed: ${backup.name}`, msg);
      throw err;
    }
  }

  private async buildArchive(
    name: string,
    sources: BackupSources,
    compression: string,
  ): Promise<ArchiveResult> {
    const allFiles = await this.collectFiles(sources);
    const shouldZip =
      compression === 'forced' ||
      (compression === 'auto' && allFiles.length !== 1);

    if (!shouldZip && allFiles.length === 1) {
      const filePath = allFiles[0];
      const buffer = readFileSync(filePath);
      return { buffer, filename: basename(filePath), size: buffer.byteLength, filesCount: 1 };
    }

    if (allFiles.length === 0) {
      return { buffer: Buffer.alloc(0), filename: `${name}.zip`, size: 0, filesCount: 0 };
    }

    const buffer = await this.createZip(allFiles);
    const slug = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${slug}_${new Date().toISOString().slice(0, 10)}.zip`;
    return { buffer, filename, size: buffer.byteLength, filesCount: allFiles.length };
  }

  private async collectFiles(sources: BackupSources): Promise<string[]> {
    const results: string[] = [];
    const excludePatterns = sources.exclude ?? [];

    const matchesExclude = (filePath: string): boolean => {
      const name = basename(filePath);
      return excludePatterns.some((pattern) => {
        if (pattern.startsWith('*.')) {
          return name.endsWith(pattern.slice(1));
        }
        return name === pattern || filePath.includes(pattern);
      });
    };

    const walk = async (p: string) => {
      if (!existsSync(p) || matchesExclude(p)) return;
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(p);
      } catch {
        return;
      }

      if (stat.isDirectory()) {
        const entries = await readdir(p);
        for (const entry of entries) {
          await walk(join(p, entry));
        }
      } else {
        results.push(p);
      }
    };

    for (const path of sources.paths) {
      await walk(path);
    }

    return results;
  }

  private createZip(files: string[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 6 } });

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      for (const file of files) {
        archive.file(file, { name: basename(file) });
      }

      void archive.finalize();
    });
  }

  private async sendOutput(
    backupName: string,
    output: BackupOutput,
    archive: ArchiveResult,
  ): Promise<void> {
    if (output.type !== 'mail') return;

    const smtpPayload = await this.vault.getEmailPayload(output.vaultId);
    const toContacts = await this.resolveContacts(output.recipientsTo);
    const ccContacts = await this.resolveContacts(output.recipientsCc);
    const bccContacts = await this.resolveContacts(output.recipientsBcc);
    const ccEmails = ccContacts.map((c) => c.email);
    const bccEmails = bccContacts.map((c) => c.email);

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
    if (output.overrideBodyType) bodyType = output.overrideBodyType as 'text' | 'html';

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
      tpl.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => extra[key] ?? baseVars[key] ?? `{{${key}}}`);

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

    const attachments = archive.size > 0
      ? [{ filename: archive.filename, content: archive.buffer }]
      : [];

    const recipients = toContacts.length > 0
      ? toContacts
      : [{ name: '', email: '' }];

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
          ...(bodyType === 'html' ? { html: resolvedBody } : { text: resolvedBody }),
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
        this.logs.error('backup', 'BACKUP_MAIL_ERROR', `Mail send failed for backup ${backupName}`, msg);
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
      .filter((c): c is { id: string; name: string; email: string } => c != null);
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }
}
