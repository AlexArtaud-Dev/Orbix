import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VaultService } from './vault.service';

@Injectable()
export class VaultScheduler {
  private readonly logger = new Logger(VaultScheduler.name);

  constructor(private readonly vaultService: VaultService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSmtpConnections() {
    this.logger.debug('Running SMTP health check on all vault email configs');
    await this.vaultService.checkAllEmail();
  }
}
