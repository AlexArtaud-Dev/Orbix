import type { Readable } from 'node:stream';

export interface ProviderMeta {
  type: string;
  label: string;
  icon: string;
  description: string;
}

export type FileToArchive =
  | { abs: string; arc: string; buffer?: never; stream?: never }
  | { buffer: Buffer; arc: string; abs?: never; stream?: never }
  | { stream: Readable; arc: string; abs?: never; buffer?: never };

export interface ArchiveResult {
  buffer: Buffer;
  filename: string;
  size: number;
  filesCount: number;
}

export interface OutputRow {
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
  createdAt: Date;
  updatedAt: Date;
}
