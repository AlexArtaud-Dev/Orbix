import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LogsWriter } from '../logs/logs.writer';
import { VaultService } from './vault.service';
import { OrbixException } from '../../common/exceptions';
import { ModuleSettingsService } from '../module-settings/module-settings.service';

@Injectable()
export class VaultScheduler {
  constructor(
    private readonly vaultService: VaultService,
    private readonly logs: LogsWriter,
    private readonly moduleSettings: ModuleSettingsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSmtpConnections() {
    try {
      const rawSettings = (await this.moduleSettings.getOne('mail'))
        .values as unknown;

      const settingsObj =
        typeof rawSettings === 'object' && rawSettings !== null
          ? (rawSettings as {
              smtpHealthCheckEnabled?: unknown;
              smtpHealthCheckIntervalMinutes?: unknown;
            })
          : {};

      const enabled =
        typeof settingsObj.smtpHealthCheckEnabled === 'boolean'
          ? settingsObj.smtpHealthCheckEnabled
          : true;
      if (!enabled) return;

      let intervalMinutes = 60;
      const candidate = settingsObj.smtpHealthCheckIntervalMinutes;
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        intervalMinutes = Math.max(1, Math.floor(candidate));
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
