import { Injectable } from '@nestjs/common';
import type { IInputProvider } from './input-provider.interface';

@Injectable()
export class InputProviderRegistry {
  private readonly map = new Map<string, IInputProvider>();

  register(provider: IInputProvider): void {
    this.map.set(provider.type, provider);
  }

  get(type: string): IInputProvider | undefined {
    return this.map.get(type);
  }

  all(): IInputProvider[] {
    return [...this.map.values()];
  }
}
