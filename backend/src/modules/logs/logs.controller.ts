import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { LogsService } from './logs.service';

@Controller('api/logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('categories')
  async categories() {
    const data = await this.logsService.getCategories();
    return { data };
  }

  @Get()
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string | string[],
    @Query('level') level?: string | string[],
    @Query('backupId') backupId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const result = await this.logsService.list({
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      category,
      level,
      backupId,
      from,
      to,
    });
    return { data: result };
  }

  @Get('backup-error-summary')
  async backupErrorSummary() {
    const data = await this.logsService.getBackupErrorSummary();
    return { data };
  }

  @Get('backup/:backupId')
  async backupLogs(
    @Param('backupId') backupId: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.logsService.listBackupLogs(
      backupId,
      limit ? parseInt(limit, 10) : 50,
    );
    return { data };
  }

  @Delete('backup/:backupId')
  async clearBackupLogs(@Param('backupId') backupId: string) {
    await this.logsService.clearBackupLogs(backupId);
    return { data: { cleared: true } };
  }
}
