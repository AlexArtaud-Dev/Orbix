import { IsIn, IsNotEmpty, IsObject, IsString } from 'class-validator';
import type { HttpVaultSubtype } from '../vault.types';

const HTTP_SUBTYPES: HttpVaultSubtype[] = [
  'token',
  'username_password',
  'key_secret',
  'oauth2_client_credentials',
  'oauth2_password_grant',
  'mtls_certificate',
  'ssh_key',
  'jwt_signing_key',
  'aws_sigv4',
  'cookie',
  'custom_kv',
];

export class CreateHttpVaultDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(HTTP_SUBTYPES)
  subtype: HttpVaultSubtype;

  @IsObject()
  data: Record<string, unknown>;
}
