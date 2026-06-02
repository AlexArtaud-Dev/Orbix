import { api } from "@/lib/api";

export interface SystemSettings {
  id: string;
  maxFileSizeMb: number;
  logRetentionDays: number;
  backupRetentionDays: number;
  defaultTimezone: string;
  defaultLanguage: string;
  defaultTheme: string;
}

export type UpdateSettingsPayload = Partial<Omit<SystemSettings, "id">>;

export const settingsService = {
  get: () => api.get<SystemSettings>("/api/settings"),
  update: (data: UpdateSettingsPayload) =>
    api.patch<SystemSettings>("/api/settings", data),
};
