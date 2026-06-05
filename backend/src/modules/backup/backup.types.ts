export interface BackupSource {
  path: string;
  type: 'file' | 'folder';
  exclude: string[];
}

export interface BackupSources {
  sources: BackupSource[];
}

export function parseBackupSources(json: unknown): BackupSources {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { sources: [] };
  }
  const obj = json as Record<string, unknown>;

  if (Array.isArray(obj['sources'])) {
    return {
      sources: (obj['sources'] as unknown[]).flatMap((s) => {
        if (typeof s !== 'object' || s === null) return [];
        const src = s as Record<string, unknown>;
        const path = typeof src['path'] === 'string' ? src['path'] : '';
        if (!path) return [];
        return [{
          path,
          type: src['type'] === 'file' ? ('file' as const) : ('folder' as const),
          exclude: Array.isArray(src['exclude']) ? (src['exclude'] as string[]) : [],
        }];
      }),
    };
  }

  // Backward compat: {paths: string[], exclude: string[]}
  if (Array.isArray(obj['paths'])) {
    const globalExclude = Array.isArray(obj['exclude']) ? (obj['exclude'] as string[]) : [];
    return {
      sources: (obj['paths'] as string[]).map((p) => ({
        path: p,
        type: 'folder' as const,
        exclude: globalExclude,
      })),
    };
  }

  return { sources: [] };
}

export type ScheduleConfig = Record<string, unknown> | null;

export function parseScheduleConfig(json: unknown): ScheduleConfig {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as ScheduleConfig;
}

export interface BackupOutputData {
  id: string;
  backupId: string;
  type: string;
  vaultId: string;
  templateId: string | null;
  recipientsTo: string[];
  recipientsCc: string[];
  recipientsBcc: string[];
  overrideSubject: string | null;
  overrideBody: string | null;
  overrideBodyType: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface BackupData {
  id: string;
  name: string;
  sources: BackupSources;
  scheduleType: string;
  scheduleConfig: ScheduleConfig;
  schedule: string | null;
  enabled: boolean;
  archiveFormat: string;
  zipCompression: string;
  zipPassword: string | null;
  zipFilename: string | null;
  isValidated: boolean;
  validationStatus: string | null;
  validationError: string | null;
  validatedAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  outputs: BackupOutputData[];
  createdAt: string;
  updatedAt: string;
}
