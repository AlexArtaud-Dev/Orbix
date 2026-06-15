import { Module, OnModuleInit } from '@nestjs/common';
import { VaultModule } from '../modules/vault/vault.module';
import { ModuleSettingsModule } from '../modules/module-settings/module-settings.module';
import { ModuleSettingsRegistry } from './module-settings.registry';
import { hasModuleSettings } from './module-settings.interface';
import { InputProviderRegistry } from './input/input-provider.registry';
import { HttpRestInputProvider } from './input/http-rest/http-rest.provider';
import { SshInputProvider } from './input/ssh/ssh-input.provider';
import { OutputProviderRegistry } from './output/output-provider.registry';
import { MailOutputProvider } from './output/mail/mail.provider';
import { SshOutputProvider } from './output/ssh/ssh.provider';
import { ProvidersController } from './providers.controller';

/**
 * Registers all built-in input/output providers and exposes their registries.
 *
 * To add a new provider:
 *   1. Create a class implementing IInputProvider or IOutputProvider.
 *   2. Add it to the `providers` array below.
 *   3. Inject it in the constructor and call registry.register() in onModuleInit.
 *   4. Optionally implement IModuleSettingsProvider to expose configurable settings.
 */
@Module({
  imports: [VaultModule, ModuleSettingsModule],
  controllers: [ProvidersController],
  providers: [
    InputProviderRegistry,
    HttpRestInputProvider,
    SshInputProvider,
    OutputProviderRegistry,
    MailOutputProvider,
    SshOutputProvider,
  ],
  exports: [
    InputProviderRegistry,
    OutputProviderRegistry,
    ModuleSettingsModule,
  ],
})
export class ProvidersModule implements OnModuleInit {
  constructor(
    private readonly inputRegistry: InputProviderRegistry,
    private readonly outputRegistry: OutputProviderRegistry,
    private readonly httpRest: HttpRestInputProvider,
    private readonly sshInput: SshInputProvider,
    private readonly mail: MailOutputProvider,
    private readonly ssh: SshOutputProvider,
    private readonly moduleSettingsRegistry: ModuleSettingsRegistry,
  ) {}

  onModuleInit() {
    this.inputRegistry.register(this.httpRest);
    this.inputRegistry.register(this.sshInput);
    this.outputRegistry.register(this.mail);
    this.outputRegistry.register(this.ssh);

    const allProviders: object[] = [
      this.httpRest,
      this.sshInput,
      this.mail,
      this.ssh,
    ];
    for (const provider of allProviders) {
      if (hasModuleSettings(provider)) {
        this.moduleSettingsRegistry.register(provider.moduleSettingsDefinition);
      }
    }
  }
}
