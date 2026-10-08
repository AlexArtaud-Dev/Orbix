import { Module } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultHttpController } from './vault.http.controller';
import { VaultVarSetController } from './vault.varset.controller';
import { VaultSshController } from './vault.ssh.controller';
import { VaultService } from './vault.service';
import { VaultScheduler } from './vault.scheduler';
import { SmtpTransportPool } from './smtp-transport.pool';
import { ModuleSettingsModule } from '../module-settings/module-settings.module';

@Module({
  imports: [ModuleSettingsModule],
  controllers: [
    VaultController,
    VaultHttpController,
    VaultVarSetController,
    VaultSshController,
  ],
  providers: [VaultService, VaultScheduler, SmtpTransportPool],
  exports: [VaultService, SmtpTransportPool],
})
export class VaultModule {}
