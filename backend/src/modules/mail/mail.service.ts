import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';
import { VaultService } from '../vault/vault.service';
import type { SendMailDto } from './dto/send-mail.dto';
import { MailSendFailedException } from '../../common/exceptions';

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly logs: LogsWriter,
  ) {}

  async send(dto: SendMailDto, files: Express.Multer.File[]): Promise<void> {
    const payload = await this.vault.getEmailPayload(dto.vaultId);

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: payload.host,
      port: payload.port,
      secure: payload.secure,
      auth: { user: payload.user, pass: payload.password },
    });

    const from = payload.fromName
      ? `"${payload.fromName}" <${payload.fromAddr}>`
      : payload.fromAddr;

    const attachments = files.map((f) => ({
      filename: f.originalname,
      content: f.buffer,
    }));

    try {
      await transporter.sendMail({
        from,
        to: dto.to.join(', '),
        subject: dto.subject,
        ...(dto.bodyType === 'html' ? { html: dto.body } : { text: dto.body }),
        attachments,
      });
      await this.prisma.mailLog.create({
        data: {
          vaultId: dto.vaultId,
          toAddrs: dto.to,
          subject: dto.subject,
          status: 'sent',
        },
      });
      this.logs.info(
        'mail',
        'MAIL_SENT',
        `Email sent: "${dto.subject}"`,
        `to=${dto.to.join(', ')} attachments=${files.length}`,
      );
    } catch (err) {
      const cause = err instanceof Error ? err.message : 'Send failed';
      const mailErr = new MailSendFailedException(dto.to.join(', '), cause);
      await this.prisma.mailLog.create({
        data: {
          vaultId: dto.vaultId,
          toAddrs: dto.to,
          subject: dto.subject,
          status: 'error',
          errorMsg: cause,
        },
      });
      this.logs.exception(
        'mail',
        mailErr,
        `Email send failed: "${dto.subject}"`,
      );
      throw mailErr;
    }
  }

  async getLogs(cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);
    const items = await this.prisma.mailLog.findMany({
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { sentAt: 'desc' },
    });
    const hasNext = items.length > take;
    const page = items.slice(0, take);
    return {
      data: page,
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }
}
