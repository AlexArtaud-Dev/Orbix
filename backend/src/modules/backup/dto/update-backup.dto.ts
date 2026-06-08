import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBackupOutputDto } from './create-backup.dto';

class UpdateBackupSourceDto {
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

class UpdateBackupSourcesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateBackupSourceDto)
  sources!: UpdateBackupSourceDto[];
}

export class UpdateBackupDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

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
  @Type(() => UpdateBackupSourcesDto)
  @IsOptional()
  sources?: UpdateBackupSourcesDto;

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
