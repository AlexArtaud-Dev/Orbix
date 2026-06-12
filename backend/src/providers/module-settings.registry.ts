import { Injectable } from '@nestjs/common';
import type { ModuleSettingsDefinition } from './module-settings.types';

@Injectable()
export class ModuleSettingsRegistry {
  private readonly map = new Map<string, ModuleSettingsDefinition>();

  register(def: ModuleSettingsDefinition): void {
    this.map.set(def.module, def);
  }

  get(module: string): ModuleSettingsDefinition | undefined {
    return this.map.get(module);
  }

  all(): ModuleSettingsDefinition[] {
    return [...this.map.values()];
  }
}
