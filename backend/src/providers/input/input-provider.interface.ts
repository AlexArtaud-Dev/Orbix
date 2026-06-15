import type { ProviderMeta, FileToArchive } from '../providers.types';
import type { InputRow } from '../../modules/input/input.types';

export interface InputFetchContext {
  maxSizeMb: number;
}

export interface IInputProvider {
  readonly type: string;
  readonly meta: ProviderMeta;
  fetch(input: InputRow, context: InputFetchContext): Promise<FileToArchive[]>;
  test?(
    input: InputRow,
  ): Promise<{ success: boolean; count?: number; error?: string }>;
}
