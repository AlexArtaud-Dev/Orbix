import { Controller, Get } from '@nestjs/common';
import { InputProviderRegistry } from './input/input-provider.registry';
import { OutputProviderRegistry } from './output/output-provider.registry';
import type { ProviderMeta } from './providers.types';

interface ProvidersResponse {
  inputs: ProviderMeta[];
  outputs: ProviderMeta[];
}

@Controller('api/providers')
export class ProvidersController {
  constructor(
    private readonly inputRegistry: InputProviderRegistry,
    private readonly outputRegistry: OutputProviderRegistry,
  ) {}

  @Get()
  list(): ProvidersResponse {
    return {
      inputs: this.inputRegistry.all().map((p) => p.meta),
      outputs: this.outputRegistry.all().map((p) => p.meta),
    };
  }
}
