import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBackupOutputDto } from './create-backup.dto';

class UpdateBackupSourcesDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  paths?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  exclude?: string[];
}

export class UpdateBackupDto {
  @IsString()
  @IsOptional()
  name?: string;

  @ValidateNested()
  @Type(() => UpdateBackupSourcesDto)
  @IsOptional()
  sources?: UpdateBackupSourcesDto;

  @IsIn(['none', 'auto', 'forced'])
  @IsOptional()
  compression?: string;

  @IsString()
  @IsOptional()
  schedule?: string | null;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBackupOutputDto)
  @IsOptional()
  outputs?: CreateBackupOutputDto[];
}
