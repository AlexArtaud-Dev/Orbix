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
import { VaultService } from './vault.service';
import { CreateHttpVaultDto } from './dto/create-http-vault.dto';
import { UpdateHttpVaultDto } from './dto/update-http-vault.dto';

@Controller('api/vault/http')
export class VaultHttpController {
  constructor(private readonly vaultService: VaultService) {}

  @Get()
  async list(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const result = await this.vaultService.listHttp(
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { data: result };
  }

  @Post()
  async create(@Body() dto: CreateHttpVaultDto) {
    const result = await this.vaultService.createHttp(dto);
    return { data: result };
  }

  @Get('count')
  async count() {
    const count = await this.vaultService.countHttp();
    return { data: { count } };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const result = await this.vaultService.getHttp(id);
    return { data: result };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateHttpVaultDto) {
    const result = await this.vaultService.updateHttp(id, dto);
    return { data: result };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.vaultService.deleteHttp(id);
  }
}
