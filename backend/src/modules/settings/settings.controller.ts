import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async get() {
    return { data: await this.settingsService.get() };
  }

  @Patch()
  async update(@Body() dto: UpdateSettingsDto) {
    return { data: await this.settingsService.update(dto) };
  }
}
