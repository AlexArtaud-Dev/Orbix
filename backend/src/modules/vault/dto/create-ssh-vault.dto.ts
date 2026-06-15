import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSshVaultDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsIn(['user_password', 'ssh_key']) subtype!: 'user_password' | 'ssh_key';
  @IsString() @IsNotEmpty() host!: string;
  @IsInt() @Min(1) @Max(65535) @Type(() => Number) port!: number;
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @IsNotEmpty() defaultPath!: string;

  // user_password
  @IsString() @IsOptional() password?: string;

  // ssh_key
  @IsString() @IsOptional() privateKey?: string;
  @IsString() @IsOptional() passphrase?: string;
  @IsString() @IsOptional() sudoPassword?: string;

  @IsBoolean() @IsOptional() useSudo?: boolean;
}
