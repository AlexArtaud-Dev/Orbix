import { Injectable } from '@nestjs/common';
import type { IOutputProvider } from './output-provider.interface';

@Injectable()
export class OutputProviderRegistry {
  private readonly map = new Map<string, IOutputProvider>();

  register(provider: IOutputProvider): void {
    this.map.set(provider.type, provider);
  }

  get(type: string): IOutputProvider | undefined {
    return this.map.get(type);
  }

  all(): IOutputProvider[] {
    return [...this.map.values()];
  }
}
