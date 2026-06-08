import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateInputDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['http-rest'])
  type: string;

  @IsOptional()
  @IsString()
  vaultId?: string;

  @IsObject()
  config: Record<string, unknown>;

  @IsOptional()
  requestParams?: unknown[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
