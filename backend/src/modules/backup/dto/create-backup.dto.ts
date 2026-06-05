import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BackupSourcesDto {
  @IsArray()
  @IsString({ each: true })
  paths!: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  exclude?: string[];
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
  recipientsTo!: string[];

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
}

export class CreateBackupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateNested()
  @Type(() => BackupSourcesDto)
  sources!: BackupSourcesDto;

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
