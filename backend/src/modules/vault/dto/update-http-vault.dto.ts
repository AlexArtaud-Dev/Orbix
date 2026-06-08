import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateHttpVaultDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
