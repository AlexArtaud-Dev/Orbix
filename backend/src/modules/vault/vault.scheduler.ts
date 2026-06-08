import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LogsWriter } from '../logs/logs.writer';
import { VaultService } from './vault.service';

@Injectable()
export class VaultScheduler {
  constructor(
    private readonly vaultService: VaultService,
    private readonly logs: LogsWriter,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSmtpConnections() {
    this.logs.info(
      'vault',
      'VAULT_SMTP_CRON_START',
      'SMTP health check started',
    );
    try {
      await this.vaultService.checkAllEmail();
      this.logs.info(
        'vault',
        'VAULT_SMTP_CRON_DONE',
        'SMTP health check completed',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logs.error(
        'vault',
        'VAULT_SMTP_CRON_ERROR',
        'SMTP health check failed',
        msg,
      );
    }
  }
}
