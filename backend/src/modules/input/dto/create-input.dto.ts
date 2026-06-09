import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateInputDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['http-rest'])
  type: string;

  @IsOptional()
  @ValidateIf((o: CreateInputDto) => o.vaultId !== null)
  @IsString()
  vaultId?: string | null;

  @IsObject()
  config: Record<string, unknown>;

  @IsOptional()
  requestParams?: unknown[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
