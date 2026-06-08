import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('api/mail/templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async list(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const result = await this.templatesService.list(
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { data: result };
  }

  @Post()
  async create(@Body() dto: CreateTemplateDto) {
    const data = await this.templatesService.create(dto);
    return { data };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const data = await this.templatesService.getOne(id);
    return { data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    const data = await this.templatesService.update(id, dto);
    return { data };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.templatesService.delete(id);
  }
}
