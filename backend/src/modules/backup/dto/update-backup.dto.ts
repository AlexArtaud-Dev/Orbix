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
import { CreateBackupOutputDto } from './create-backup.dto';

class UpdateBackupSourceDto {
  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsIn(['file', 'folder'])
  type!: 'file' | 'folder';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  exclude?: string[];
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
