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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('api/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async list(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const result = await this.contactsService.list(
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { data: result };
  }

  @Post()
  async create(@Body() dto: CreateContactDto) {
    const data = await this.contactsService.create(dto);
    return { data };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const data = await this.contactsService.getOne(id);
    return { data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    const data = await this.contactsService.update(id, dto);
    return { data };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.contactsService.delete(id);
  }
}
