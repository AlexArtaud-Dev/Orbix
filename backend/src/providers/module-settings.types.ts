export type SettingFieldType = 'string' | 'number' | 'boolean' | 'select';

export interface SelectOption {
  value: string;
  labelKey: string;
}

export interface SettingFieldDefinition {
  key: string;
  type: SettingFieldType;
  defaultValue: string | number | boolean;
  labelKey: string;
  descriptionKey?: string;
  min?: number;
  max?: number;
  options?: SelectOption[];
}

export interface ModuleSettingsDefinition {
  module: string;
  labelKey: string;
  descriptionKey?: string;
  fields: SettingFieldDefinition[];
}
