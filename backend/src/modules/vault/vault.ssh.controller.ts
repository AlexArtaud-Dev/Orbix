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
import { CreateSshVaultDto } from './dto/create-ssh-vault.dto';
import { UpdateSshVaultDto } from './dto/update-ssh-vault.dto';

@Controller('api/vault/ssh-remote')
export class VaultSshController {
  constructor(private readonly vaultService: VaultService) {}

  @Get()
  async list() {
    return { data: await this.vaultService.listSsh() };
  }

  @Post()
  async create(@Body() dto: CreateSshVaultDto) {
    return { data: await this.vaultService.createSsh(dto) };
  }

  @Get('count')
  async count() {
    return { data: { count: await this.vaultService.countSsh() } };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return { data: await this.vaultService.getSsh(id) };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSshVaultDto) {
    return { data: await this.vaultService.updateSsh(id, dto) };
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    await this.vaultService.deleteSsh(id);
  }

  @Post(':id/test')
  async test(@Param('id') id: string) {
    return { data: await this.vaultService.testSshConnection(id) };
  }

  @Get(':id/browse')
  async browse(@Param('id') id: string, @Query('path') path = '/') {
    return {
      data: await this.vaultService.browseSshDirectory(id, path || '/'),
    };
  }

  @Get(':id/match')
  async match(
    @Param('id') id: string,
    @Query('path') path = '/',
    @Query('pattern') pattern?: string,
    @Query('recursive') recursive?: string,
  ) {
    return {
      data: await this.vaultService.matchSshFiles(
        id,
        path || '/',
        pattern || undefined,
        recursive === 'true',
      ),
    };
  }
}
