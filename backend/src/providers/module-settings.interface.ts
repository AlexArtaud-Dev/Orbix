import type { ModuleSettingsDefinition } from './module-settings.types';

export interface IModuleSettingsProvider {
  readonly moduleSettingsDefinition: ModuleSettingsDefinition;
}

export function hasModuleSettings(
  provider: object,
): provider is IModuleSettingsProvider {
  return 'moduleSettingsDefinition' in provider;
}
