import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateInputDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  requestParams?: unknown[];

  @IsOptional()
  @IsString()
  vaultId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
