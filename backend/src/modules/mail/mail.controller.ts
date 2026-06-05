import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';

@Controller('api/mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor('attachments', 10, { limits: { fileSize: 25 * 1024 * 1024 } }))
  async send(
    @Body() dto: SendMailDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    await this.mailService.send(dto, files ?? []);
    return { data: null };
  }

  @Get('logs')
  async logs(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const result = await this.mailService.getLogs(cursor, limit ? parseInt(limit, 10) : undefined);
    return { data: result };
  }
}
