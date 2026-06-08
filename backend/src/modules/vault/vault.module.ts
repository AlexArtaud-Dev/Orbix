import { Module } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultHttpController } from './vault.http.controller';
import { VaultService } from './vault.service';
import { VaultScheduler } from './vault.scheduler';

@Module({
  controllers: [VaultController, VaultHttpController],
  providers: [VaultService, VaultScheduler],
  exports: [VaultService],
})
export class VaultModule {}
