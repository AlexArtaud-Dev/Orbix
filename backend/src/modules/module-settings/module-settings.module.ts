import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ModuleSettingsRegistry } from '../../providers/module-settings.registry';
import { ModuleSettingsService } from './module-settings.service';
import { ModuleSettingsController } from './module-settings.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ModuleSettingsController],
  providers: [ModuleSettingsRegistry, ModuleSettingsService],
  exports: [ModuleSettingsRegistry, ModuleSettingsService],
})
export class ModuleSettingsModule {}
