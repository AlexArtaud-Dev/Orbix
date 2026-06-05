import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupRunner } from './backup.runner';
import { BackupScheduler } from './backup.scheduler';
import { VaultModule } from '../vault/vault.module';

@Module({
  imports: [VaultModule],
  controllers: [BackupController],
  providers: [BackupService, BackupRunner, BackupScheduler],
})
export class BackupModule {}
