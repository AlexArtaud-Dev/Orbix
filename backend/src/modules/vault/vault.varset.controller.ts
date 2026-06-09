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
import { CreateVarSetDto } from './dto/create-varset.dto';
import { UpdateVarSetDto } from './dto/update-varset.dto';

@Controller('api/vault/varset')
export class VaultVarSetController {
  constructor(private readonly vaultService: VaultService) {}

  @Get()
  async list(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const result = await this.vaultService.listVarSet(
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { data: result };
  }

  @Post()
  async create(@Body() dto: CreateVarSetDto) {
    const result = await this.vaultService.createVarSet(dto);
    return { data: result };
  }

  @Get('count')
  async count() {
    const count = await this.vaultService.countVarSet();
    return { data: { count } };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const result = await this.vaultService.getVarSet(id);
    return { data: result };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateVarSetDto) {
    const result = await this.vaultService.updateVarSet(id, dto);
    return { data: result };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.vaultService.deleteVarSet(id);
  }
}
