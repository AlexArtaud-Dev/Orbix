import { Controller, Get, Query } from '@nestjs/common';
import { FilesService } from './files.service';

@Controller('api/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  async list(@Query('path') relPath = '') {
    const entries = await this.filesService.list(relPath);
    return { data: entries };
  }

  @Get('stat')
  async stat(@Query('path') relPath = '') {
    const stat = await this.filesService.stat(relPath);
    return { data: stat };
  }
}
