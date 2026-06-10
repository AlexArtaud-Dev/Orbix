import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupRunner } from './backup.runner';
import { BackupScheduler } from './backup.scheduler';
import { VaultModule } from '../vault/vault.module';
import { SettingsModule } from '../settings/settings.module';
import { InputModule } from '../input/input.module';
import { ProvidersModule } from '../../providers/providers.module';

@Module({
  imports: [VaultModule, SettingsModule, InputModule, ProvidersModule],
  controllers: [BackupController],
  providers: [BackupService, BackupRunner, BackupScheduler],
})
export class BackupModule {}
