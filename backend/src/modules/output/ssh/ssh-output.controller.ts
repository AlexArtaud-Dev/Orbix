import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
} from '@nestjs/common';
import { SshOutputService } from './ssh-output.service';
import { CreateSshOutputDto } from './dto/create-ssh-output.dto';
import { UpdateSshOutputDto } from './dto/update-ssh-output.dto';

@Controller('api/output/ssh')
export class SshOutputController {
  constructor(private readonly service: SshOutputService) {}

  @Get()
  async list() {
    return { data: await this.service.list() };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return { data: await this.service.getOne(id) };
  }

  @Post()
  async create(@Body() dto: CreateSshOutputDto) {
    return { data: await this.service.create(dto) };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSshOutputDto) {
    return { data: await this.service.update(id, dto) };
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
  }

  @Post(':id/test')
  async test(@Param('id') id: string) {
    return { data: await this.service.test(id) };
  }
}
