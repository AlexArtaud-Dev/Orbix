import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BackupSourceDto {
  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsIn(['file', 'folder', 'input'])
  type!: 'file' | 'folder' | 'input';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  exclude?: string[];

  @IsString()
  @IsOptional()
  inputId?: string;
}

class BackupSourcesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BackupSourceDto)
  sources!: BackupSourceDto[];
}

export class CreateBackupOutputDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  vaultId!: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipientsTo?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipientsCc?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipientsBcc?: string[];

  @IsString()
  @IsOptional()
  overrideSubject?: string;

  @IsString()
  @IsOptional()
  overrideBody?: string;

  @IsString()
  @IsOptional()
  overrideBodyType?: string;

  @IsNumber()
  @IsOptional()
  order?: number;
}

export class CreateBackupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(['local', 'input'])
  @IsOptional()
  backupType?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsIn(['manual', 'oneshoot', 'recurring', 'interval'])
  @IsOptional()
  scheduleType?: string;

  @IsObject()
  @IsOptional()
  scheduleConfig?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  schedule?: string | null;

  @ValidateNested()
  @Type(() => BackupSourcesDto)
  @IsOptional()
  sources?: BackupSourcesDto;

  @IsIn(['zip', 'tar', 'tar-gz', 'tar-bz2'])
  @IsOptional()
  archiveFormat?: string;

  @IsIn(['store', 'fast', 'default', 'best'])
  @IsOptional()
  zipCompression?: string;

  @IsString()
  @IsOptional()
  zipPassword?: string | null;

  @IsString()
  @IsOptional()
  zipFilename?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBackupOutputDto)
  @IsOptional()
  outputs?: CreateBackupOutputDto[];
}
