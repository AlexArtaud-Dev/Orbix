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
import { CreateEmailVaultDto } from './dto/create-email-vault.dto';
import { UpdateEmailVaultDto } from './dto/update-email-vault.dto';

@Controller('api/vault/email')
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Get()
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.vaultService.listEmail(
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { data: result };
  }

  @Post()
  async create(@Body() dto: CreateEmailVaultDto) {
    const result = await this.vaultService.createEmail(dto);
    return { data: result };
  }

  @Get('count')
  async count() {
    const count = await this.vaultService.countEmail();
    return { data: { count } };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const result = await this.vaultService.getEmail(id);
    return { data: result };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateEmailVaultDto) {
    const result = await this.vaultService.updateEmail(id, dto);
    return { data: result };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.vaultService.deleteEmail(id);
  }

  @Post(':id/test')
  @HttpCode(200)
  async test(@Param('id') id: string) {
    await this.vaultService.testEmail(id);
    return { data: null };
  }
}
