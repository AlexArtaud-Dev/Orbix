import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSshOutputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  vaultId: string;

  @IsString()
  @IsNotEmpty()
  destPath: string;
}
