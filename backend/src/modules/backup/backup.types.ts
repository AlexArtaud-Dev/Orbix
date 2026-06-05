export interface BackupSources {
  paths: string[];
  exclude: string[];
}

export function parseBackupSources(json: unknown): BackupSources {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { paths: [], exclude: [] };
  }
  const obj = json as Record<string, unknown>;
  return {
    paths: Array.isArray(obj['paths']) ? (obj['paths'] as string[]) : [],
    exclude: Array.isArray(obj['exclude']) ? (obj['exclude'] as string[]) : [],
  };
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
  createdAt: string;
  updatedAt: string;
}

export interface BackupData {
  id: string;
  name: string;
  sources: BackupSources;
  compression: string;
  schedule: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  outputs: BackupOutputData[];
  createdAt: string;
  updatedAt: string;
}
