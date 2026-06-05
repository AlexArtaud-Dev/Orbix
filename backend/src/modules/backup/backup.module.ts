import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupRunner } from './backup.runner';
import { BackupScheduler } from './backup.scheduler';
import { VaultModule } from '../vault/vault.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [VaultModule, SettingsModule],
  controllers: [BackupController],
  providers: [BackupService, BackupRunner, BackupScheduler],
})
export class BackupModule {}
