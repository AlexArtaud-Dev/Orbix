import { Global, Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { LogsWriter } from './logs.writer';
import { SettingsModule } from '../settings/settings.module';

@Global()
@Module({
  imports: [SettingsModule],
  controllers: [LogsController],
  providers: [LogsService, LogsWriter],
  exports: [LogsWriter],
})
export class LogsModule {}
