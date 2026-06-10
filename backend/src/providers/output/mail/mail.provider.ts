import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { VaultService } from '../../../modules/vault/vault.service';
import { LogsWriter } from '../../../modules/logs/logs.writer';
import type { IOutputProvider } from '../output-provider.interface';
import type {
  ProviderMeta,
  ArchiveResult,
  OutputRow,
} from '../../providers.types';
import { MailSendFailedException } from '../../../common/exceptions';

@Injectable()
export class MailOutputProvider implements IOutputProvider {
  readonly type = 'mail';
  readonly meta: ProviderMeta = {
    type: 'mail',
    label: 'Email',
    icon: 'mail',
    description: 'Send the backup archive as an email attachment via SMTP.',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly logs: LogsWriter,
  ) {}

  async send(
    output: OutputRow,
    archive: ArchiveResult,
    backupName: string,
    backupId: string,
  ): Promise<void> {
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
        const cause = err instanceof Error ? err.message : 'Send failed';
        const mailErr = new MailSendFailedException(
          contact.email || '(no recipient)',
          cause,
        );
        await this.prisma.mailLog.create({
          data: {
            vaultId: output.vaultId,
            toAddrs: contact.email ? [contact.email] : [],
            subject: resolvedSubject,
            status: 'error',
            errorMsg: cause,
          },
        });
        this.logs.exception(
          'mail',
          mailErr,
          `Mail send failed for backup ${backupName}`,
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
