import { Module } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultHttpController } from './vault.http.controller';
import { VaultVarSetController } from './vault.varset.controller';
import { VaultSshController } from './vault.ssh.controller';
import { VaultService } from './vault.service';
import { VaultScheduler } from './vault.scheduler';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [
    VaultController,
    VaultHttpController,
    VaultVarSetController,
    VaultSshController,
  ],
  providers: [VaultService, VaultScheduler],
  exports: [VaultService],
})
export class VaultModule {}
