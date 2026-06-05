import { Global, Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { LogsWriter } from './logs.writer';

@Global()
@Module({
  controllers: [LogsController],
  providers: [LogsService, LogsWriter],
  exports: [LogsWriter],
})
export class LogsModule {}
