import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ModuleSettingsService } from './module-settings.service';

@Controller('api/settings/modules')
export class ModuleSettingsController {
  constructor(private readonly service: ModuleSettingsService) {}

  @Get()
  async getAll() {
    return { data: await this.service.getAll() };
  }

  @Get(':module')
  async getOne(@Param('module') module: string) {
    return { data: await this.service.getOne(module) };
  }

  @Put(':module')
  async update(
    @Param('module') module: string,
    @Body() body: Record<string, unknown>,
  ) {
    return { data: await this.service.setValues(module, body) };
  }
}
