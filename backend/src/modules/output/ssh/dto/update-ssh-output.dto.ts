import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateSshOutputDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  vaultId?: string;

  @IsString()
  @IsOptional()
  destPath?: string;
}
