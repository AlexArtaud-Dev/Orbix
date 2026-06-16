import type {
  ProviderMeta,
  ArchiveResult,
  OutputRow,
} from '../providers.types';

export interface IOutputProvider {
  readonly type: string;
  readonly meta: ProviderMeta;
  send(
    output: OutputRow,
    archive: ArchiveResult,
    backupName: string,
    backupId: string,
    isValidation?: boolean,
  ): Promise<void>;
}
