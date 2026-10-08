import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Transporter } from 'nodemailer';
import { VaultService } from './vault.service';
import type { EmailPayload } from './vault.types';

interface PooledTransport {
  fingerprint: string;
  transporter: Transporter;
}

// One shared connection per vault: a burst of sends costs one SMTP login, not one per message.
@Injectable()
export class SmtpTransportPool implements OnModuleDestroy {
  private readonly transports = new Map<string, PooledTransport>();

  constructor(private readonly vault: VaultService) {}

  async get(
    vaultId: string,
  ): Promise<{ transporter: Transporter; payload: EmailPayload }> {
    const payload = await this.vault.getEmailPayload(vaultId);
    const nodemailer = await import('nodemailer');

    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          payload.host,
          payload.port,
          payload.secure,
          payload.user,
          payload.password,
        ]),
      )
      .digest('hex');

    const cached = this.transports.get(vaultId);
    if (cached?.fingerprint === fingerprint) {
      return { transporter: cached.transporter, payload };
    }
    cached?.transporter.close();

    const transporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 1,
      host: payload.host,
      port: payload.port,
      secure: payload.secure,
      auth: { user: payload.user, pass: payload.password },
    });
    this.transports.set(vaultId, { fingerprint, transporter });
    return { transporter, payload };
  }

  onModuleDestroy(): void {
    for (const { transporter } of this.transports.values()) {
      transporter.close();
    }
    this.transports.clear();
  }
}
