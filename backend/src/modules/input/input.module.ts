import { Module } from '@nestjs/common';
import { InputController } from './input.controller';
import { InputService } from './input.service';
import { VaultModule } from '../vault/vault.module';
import { ModuleSettingsModule } from '../module-settings/module-settings.module';

@Module({
  imports: [VaultModule, ModuleSettingsModule],
  controllers: [InputController],
  providers: [InputService],
  exports: [InputService],
})
export class InputModule {}
