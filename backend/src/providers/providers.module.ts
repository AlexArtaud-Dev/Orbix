import { Module, OnModuleInit } from '@nestjs/common';
import { VaultModule } from '../modules/vault/vault.module';
import { InputProviderRegistry } from './input/input-provider.registry';
import { HttpRestInputProvider } from './input/http-rest/http-rest.provider';
import { OutputProviderRegistry } from './output/output-provider.registry';
import { MailOutputProvider } from './output/mail/mail.provider';
import { ProvidersController } from './providers.controller';

/**
 * Registers all built-in input/output providers and exposes their registries.
 *
 * To add a new provider:
 *   1. Create a class implementing IInputProvider or IOutputProvider.
 *   2. Add it to the `providers` array below.
 *   3. Inject it in the constructor and call registry.register() in onModuleInit.
 */
@Module({
  imports: [VaultModule],
  controllers: [ProvidersController],
  providers: [
    InputProviderRegistry,
    HttpRestInputProvider,
    OutputProviderRegistry,
    MailOutputProvider,
  ],
  exports: [InputProviderRegistry, OutputProviderRegistry],
})
export class ProvidersModule implements OnModuleInit {
  constructor(
    private readonly inputRegistry: InputProviderRegistry,
    private readonly outputRegistry: OutputProviderRegistry,
    private readonly httpRest: HttpRestInputProvider,
    private readonly mail: MailOutputProvider,
  ) {}

  onModuleInit() {
    this.inputRegistry.register(this.httpRest);
    this.outputRegistry.register(this.mail);
  }
}
