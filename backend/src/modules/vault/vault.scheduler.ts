import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LogsWriter } from '../logs/logs.writer';
import { VaultService } from './vault.service';
import { OrbixException } from '../../common/exceptions';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class VaultScheduler {
  constructor(
    private readonly vaultService: VaultService,
    private readonly logs: LogsWriter,
    private readonly settings: SettingsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSmtpConnections() {
    try {
      const rawSettings = (await this.settings.get()) as unknown;
      let intervalMinutes = 5;
      if (
        typeof rawSettings === 'object' &&
        rawSettings !== null &&
        'smtpHealthCheckIntervalMinutes' in rawSettings
      ) {
        const candidate = (
          rawSettings as { smtpHealthCheckIntervalMinutes?: unknown }
        ).smtpHealthCheckIntervalMinutes;
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
          intervalMinutes = Math.max(1, Math.floor(candidate));
        }
      }
      const checkedCount =
        await this.vaultService.checkAllEmail(intervalMinutes);
      if (checkedCount > 0) {
        this.logs.info(
          'vault',
          'VAULT_SMTP_CRON_DONE',
          `SMTP health check completed (${checkedCount} vault(s), interval ${intervalMinutes} minute(s))`,
        );
      }
    } catch (err) {
      if (err instanceof OrbixException) {
        this.logs.exception('vault', err, 'SMTP health check failed');
      } else {
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
}
