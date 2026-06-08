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
import { InputService } from './input.service';
import { CreateInputDto } from './dto/create-input.dto';
import { UpdateInputDto } from './dto/update-input.dto';

@Controller('api/inputs')
export class InputController {
  constructor(private readonly inputService: InputService) {}

  @Get()
  async list(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const result = await this.inputService.list(
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { data: result.data, nextCursor: result.nextCursor };
  }

  @Post()
  async create(@Body() dto: CreateInputDto) {
    const result = await this.inputService.create(dto);
    return { data: result };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const result = await this.inputService.getOne(id);
    return { data: result };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateInputDto) {
    const result = await this.inputService.update(id, dto);
    return { data: result };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.inputService.delete(id);
  }

  @Post(':id/test')
  async test(@Param('id') id: string) {
    const result = await this.inputService.test(id);
    return { data: result };
  }
}
