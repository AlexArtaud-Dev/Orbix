import { Module } from '@nestjs/common';
import { SshOutputController } from './ssh-output.controller';
import { SshOutputService } from './ssh-output.service';
import { VaultModule } from '../../vault/vault.module';

@Module({
  imports: [VaultModule],
  controllers: [SshOutputController],
  providers: [SshOutputService],
  exports: [SshOutputService],
})
export class SshOutputModule {}
