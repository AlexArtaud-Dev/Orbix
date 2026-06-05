import { Controller, Get, Query } from '@nestjs/common';
import { LogsService } from './logs.service';
import type { LogCategory, LogLevel } from './logs.writer';

@Controller('api/logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: LogCategory,
    @Query('level') level?: LogLevel,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const result = await this.logsService.list({
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      category,
      level,
      from,
      to,
    });
    return { data: result };
  }
}
