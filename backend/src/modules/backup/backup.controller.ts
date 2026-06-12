import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupScheduler } from './backup.scheduler';
import { BackupRunner } from './backup.runner';
import { CreateBackupDto } from './dto/create-backup.dto';
import { UpdateBackupDto } from './dto/update-backup.dto';

@Controller('api/backups')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly scheduler: BackupScheduler,
    private readonly runner: BackupRunner,
  ) {}

  @Get()
  async list() {
    const data = await this.backupService.list();
    return { data };
  }

  @Post()
  async create(@Body() dto: CreateBackupDto) {
    const data = await this.backupService.create(dto);
    if (data.enabled) {
      this.scheduler.register(
        data.id,
        data.name,
        data.scheduleType,
        data.schedule,
        data.scheduleConfig,
      );
    }
    return { data };
  }

  // ── Literal routes BEFORE :id to avoid route conflicts ───────────────────

  @Get('zip-info')
  getZipInfo() {
    return { data: this.runner.getZipInfo() };
  }

  @Post('zip-test')
  @HttpCode(200)
  async zipTest() {
    const data = await this.runner.testZip();
    return { data };
  }

  // ── Parameterized routes ──────────────────────────────────────────────────

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const data = await this.backupService.getOne(id);
    return { data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBackupDto) {
    const data = await this.backupService.update(id, dto);
    this.scheduler.remove(data.id);
    if (data.enabled) {
      this.scheduler.register(
        data.id,
        data.name,
        data.scheduleType,
        data.schedule,
        data.scheduleConfig,
      );
    }
    return { data };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    this.scheduler.remove(id);
    await this.backupService.delete(id);
  }

  @Post(':id/run')
  @HttpCode(202)
  run(@Param('id') id: string) {
    void this.runner.run(id, 'manual');
    return { data: { accepted: true } };
  }

  @Post(':id/validate')
  @HttpCode(202)
  async validate(@Param('id') id: string) {
    await this.backupService.startValidation(id);
    void this.runner.runValidation(id);
    return { data: { accepted: true } };
  }
}
