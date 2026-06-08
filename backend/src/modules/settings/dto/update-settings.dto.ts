import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxFileSizeMb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(87600) // max 10 years in hours
  logRetentionHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  backupRetentionDays?: number;

  @IsOptional()
  @IsString()
  defaultTimezone?: string;

  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @IsOptional()
  @IsString()
  defaultTheme?: string;

  @IsOptional()
  @IsString()
  filesRoot?: string;
}
