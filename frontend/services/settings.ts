import { api } from "@/lib/api";

export interface SystemSettings {
  id: string;
  maxFileSizeMb: number;
  logRetentionHours: number;
  backupRetentionDays: number;
  defaultTimezone: string;
  defaultLanguage: string;
  defaultTheme: string;
  filesRoot: string;
  maxSourceFileSizeMb: number;
  maxBackupTotalSizeMb: number;
}

export type UpdateSettingsPayload = Partial<Omit<SystemSettings, "id">>;

// ─── Module settings types ────────────────────────────────────────────────────

export type SettingFieldType = "string" | "number" | "boolean" | "select";

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

export interface ModuleSettingsWithValues {
  definition: ModuleSettingsDefinition;
  values: Record<string, unknown>;
}

// ─── Services ─────────────────────────────────────────────────────────────────

export const settingsService = {
  get: () => api.get<SystemSettings>("/api/settings"),
  update: (data: UpdateSettingsPayload) =>
    api.patch<SystemSettings>("/api/settings", data),
};

export const moduleSettingsService = {
  getAll: () => api.get<ModuleSettingsWithValues[]>("/api/settings/modules"),
  getOne: (module: string) =>
    api.get<ModuleSettingsWithValues>(`/api/settings/modules/${module}`),
  update: (module: string, values: Record<string, unknown>) =>
    api.put<Record<string, unknown>>(`/api/settings/modules/${module}`, values),
};
