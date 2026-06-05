import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { VaultModule } from '../vault/vault.module';

@Module({
  imports: [VaultModule],
  controllers: [MailController, TemplatesController],
  providers: [MailService, TemplatesService],
})
export class MailModule {}
