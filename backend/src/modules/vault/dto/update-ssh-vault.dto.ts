import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSshVaultDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() host?: string;
  @IsInt() @Min(1) @Max(65535) @IsOptional() @Type(() => Number) port?: number;
  @IsString() @IsOptional() username?: string;
  @IsString() @IsOptional() defaultPath?: string;
  @IsString() @IsOptional() password?: string;
  @IsString() @IsOptional() privateKey?: string;
  @IsString() @IsOptional() passphrase?: string;
  @IsString() @IsOptional() sudoPassword?: string;
  @IsBoolean() @IsOptional() useSudo?: boolean;
}
