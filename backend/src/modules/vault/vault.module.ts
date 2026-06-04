import { Module } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { VaultScheduler } from './vault.scheduler';

@Module({
  controllers: [VaultController],
  providers: [VaultService, VaultScheduler],
  exports: [VaultService],
})
export class VaultModule {}
