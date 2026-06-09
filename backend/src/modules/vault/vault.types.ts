// ─── Email vault ─────────────────────────────────────────────────────────────

export interface EmailPayload {
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddr: string;
  fromName: string;
  secure: boolean;
}

export interface EmailVaultResponse {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  fromAddr: string;
  fromName: string;
  secure: boolean;
  smtpStatus: string | null;
  smtpStatusMsg: string | null;
  smtpCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── HTTP vault ───────────────────────────────────────────────────────────────

export type HttpVaultSubtype =
  | 'token'
  | 'username_password'
  | 'key_secret'
  | 'oauth2_client_credentials'
  | 'oauth2_password_grant'
  | 'mtls_certificate'
  | 'ssh_key'
  | 'jwt_signing_key'
  | 'aws_sigv4'
  | 'cookie'
  | 'custom_kv';

export interface TokenPayload {
  subtype: 'token';
  token: string;
}
export interface UsernamePasswordPayload {
  subtype: 'username_password';
  username: string;
  password: string;
}
export interface KeySecretPayload {
  subtype: 'key_secret';
  key: string;
  secret: string;
}
export interface OAuth2ClientCredentialsPayload {
  subtype: 'oauth2_client_credentials';
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope?: string;
}
export interface OAuth2PasswordGrantPayload {
  subtype: 'oauth2_password_grant';
  username: string;
  password: string;
  clientId: string;
  tokenUrl: string;
}
export interface MtlsCertificatePayload {
  subtype: 'mtls_certificate';
  cert: string;
  key: string;
  passphrase?: string;
}
export interface SshKeyPayload {
  subtype: 'ssh_key';
  privateKey: string;
  passphrase?: string;
}
export interface JwtSigningKeyPayload {
  subtype: 'jwt_signing_key';
  privateKey: string;
  algorithm: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
}
export interface AwsSigV4Payload {
  subtype: 'aws_sigv4';
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}
export interface CookiePayload {
  subtype: 'cookie';
  value: string;
}
export interface CustomKvPayload {
  subtype: 'custom_kv';
  entries: Array<{ key: string; value: string }>;
}

export type HttpVaultPayload =
  | TokenPayload
  | UsernamePasswordPayload
  | KeySecretPayload
  | OAuth2ClientCredentialsPayload
  | OAuth2PasswordGrantPayload
  | MtlsCertificatePayload
  | SshKeyPayload
  | JwtSigningKeyPayload
  | AwsSigV4Payload
  | CookiePayload
  | CustomKvPayload;

export interface HttpVaultResponse {
  id: string;
  name: string;
  subtype: HttpVaultSubtype;
  createdAt: string;
  updatedAt: string;
}

// ─── Variable Set vault ───────────────────────────────────────────────────────

export interface VarSetVariable {
  key: string;
  value: string;
}

export interface VarSetPayload {
  variables: VarSetVariable[];
}

export interface VarSetResponse {
  id: string;
  name: string;
  /** URL-safe slug derived from name — used in {{vault.var.<slug>.<key>}} templates */
  slug: string;
  /** Number of variables stored (values never returned in list/get) */
  variableCount: number;
  /** Variable keys — values are never exposed */
  variableKeys: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Shared row type ──────────────────────────────────────────────────────────

export type VaultRow = {
  id: string;
  name: string;
  type: string;
  encryptedPayload: string;
  smtpStatus: string | null;
  smtpStatusMsg: string | null;
  smtpCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
