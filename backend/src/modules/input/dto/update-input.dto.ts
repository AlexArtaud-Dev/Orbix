import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

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
  @ValidateIf((o: UpdateInputDto) => o.vaultId !== null)
  @IsString()
  vaultId?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
